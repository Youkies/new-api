package controller

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	kpayPendingSweepInterval     = 5 * time.Minute
	kpayPendingSweepBatchLimit   = 50
	kpayPendingSweepMinAgeSecs   = int64(2 * 60)
	kpayPendingSweepMaxAgeSecs   = int64(7 * 24 * 60 * 60)
	kpayPendingSweepPerItemPause = 50 * time.Millisecond
)

var (
	kpayPendingSweepOnce    sync.Once
	kpayPendingSweepRunning atomic.Bool
)

// StartKPayPendingSweepTask 启动 KPay 长期 pending 订单的定时补查任务。
// 仅在 master 节点运行。每轮按上限批量扫描 provider_order_no 非空、状态仍为 pending
// 且创建时间落入合理窗口的订单，逐个加订单互斥锁并复用 reconcileKPayTopUp 做查单和入账。
func StartKPayPendingSweepTask() {
	if !common.IsMasterNode {
		return
	}
	kpayPendingSweepOnce.Do(func() {
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("kpay pending sweep task started: interval=%s batch_limit=%d window=[%ds,%ds]", kpayPendingSweepInterval, kpayPendingSweepBatchLimit, kpayPendingSweepMinAgeSecs, kpayPendingSweepMaxAgeSecs))
			ticker := time.NewTicker(kpayPendingSweepInterval)
			defer ticker.Stop()
			runKPayPendingSweepOnce()
			for range ticker.C {
				runKPayPendingSweepOnce()
			}
		})
	})
}

func runKPayPendingSweepOnce() {
	if !isKPayTopUpEnabled() {
		return
	}
	if !kpayPendingSweepRunning.CompareAndSwap(false, true) {
		return
	}
	defer kpayPendingSweepRunning.Store(false)

	ctx := context.Background()
	topups, err := model.ScanStalePendingKPayTopUps(kpayPendingSweepMinAgeSecs, kpayPendingSweepMaxAgeSecs, kpayPendingSweepBatchLimit)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("kpay pending sweep scan failed: %v", err))
		return
	}
	if len(topups) == 0 {
		return
	}

	var changedCount, errorCount int
	for _, topUp := range topups {
		if topUp == nil {
			continue
		}
		func() {
			LockOrder(topUp.TradeNo)
			defer UnlockOrder(topUp.TradeNo)

			// 加锁后重新加载，避免拿到陈旧状态
			fresh := model.GetTopUpByTradeNo(topUp.TradeNo)
			if fresh == nil || fresh.PaymentProvider != model.PaymentProviderKPay {
				return
			}
			if fresh.Status != common.TopUpStatusPending {
				return
			}

			res := reconcileKPayTopUp(ctx, fresh, "", "", "sweep")
			if res.err != nil {
				errorCount++
				return
			}
			if res.changed {
				changedCount++
				logger.LogInfo(ctx, fmt.Sprintf("kpay pending sweep updated trade_no=%s provider_order_no=%s local_status=%s provider_status=%s", fresh.TradeNo, fresh.ProviderOrderNo, res.localStatus, res.providerStatus))
			}
		}()
		// 限速，避免对 KPay API 形成突发压力
		time.Sleep(kpayPendingSweepPerItemPause)
	}

	if changedCount > 0 || errorCount > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("kpay pending sweep finished scanned=%d changed=%d errors=%d", len(topups), changedCount, errorCount))
	}
}
