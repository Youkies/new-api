package controller

import (
	"context"
	"fmt"
	"strings"
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

// kpayPostCreateBackoff 为单订单下单后短期跟踪的轮询间隔序列。
// 总跨度约 11 分钟，覆盖典型用户支付路径（扫码→打开支付 App→输入密码→完成支付）
// 以及关闭浏览器但 webhook 失败或延迟的常见场景。
// 第一次间隔故意大于本地端 5 秒轮询的窗口，避免和前端查单冲突重复查 KPay。
var kpayPostCreateBackoff = []time.Duration{
	25 * time.Second,
	35 * time.Second,
	45 * time.Second,
	60 * time.Second,
	90 * time.Second,
	90 * time.Second,
	120 * time.Second,
	120 * time.Second,
	120 * time.Second,
}

const kpayPostCreateMaxInFlight int64 = 200

var kpayPostCreateInFlight atomic.Int64

// SchedulePostCreateKPayWatch 在创建 KPay 订单成功后启动一个轻量后台 goroutine，
// 按 kpayPostCreateBackoff 退避序列向 KPay 查单，覆盖用户支付完就切后台、
// 关闭浏览器或网络丢失导致前端 5 秒轮询缺席的场景。
// 全局 5 分钟扫描任务负责更长周期的兜底。
//
// 退出条件：
//   - 订单状态不再 pending（已 success / failed / expired）
//   - 完成全部退避序列
//   - in-flight 数量超过 kpayPostCreateMaxInFlight（直接放弃，由全局扫描兜底）
//
// 仅 master 节点启动，避免 slave 节点重复查单。
func SchedulePostCreateKPayWatch(tradeNo string, providerOrderNo string) {
	if !common.IsMasterNode {
		return
	}
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return
	}
	if strings.TrimSpace(providerOrderNo) == "" {
		// 没有平台单号无法查 KPay，让 isKPayLocalFallbackExpired 走 15 分钟兜底
		return
	}
	if !isKPayTopUpEnabled() {
		return
	}
	if kpayPostCreateInFlight.Add(1) > kpayPostCreateMaxInFlight {
		kpayPostCreateInFlight.Add(-1)
		return
	}

	gopool.Go(func() {
		defer kpayPostCreateInFlight.Add(-1)
		ctx := context.Background()
		for _, delay := range kpayPostCreateBackoff {
			time.Sleep(delay)
			if !isKPayTopUpEnabled() {
				return
			}
			done := runKPayPostCreateProbe(ctx, tradeNo)
			if done {
				return
			}
		}
	})
}

// runKPayPostCreateProbe 对单个订单做一次加锁查单。返回 true 表示订单已脱离 pending，
// 调用方应停止后续探测。
func runKPayPostCreateProbe(ctx context.Context, tradeNo string) bool {
	LockOrder(tradeNo)
	defer UnlockOrder(tradeNo)

	fresh := model.GetTopUpByTradeNo(tradeNo)
	if fresh == nil || fresh.PaymentProvider != model.PaymentProviderKPay {
		return true
	}
	if fresh.Status != common.TopUpStatusPending {
		return true
	}

	res := reconcileKPayTopUp(ctx, fresh, "", "", "post_create_watch")
	if res.changed {
		logger.LogInfo(ctx, fmt.Sprintf("kpay post-create watch updated trade_no=%s provider_order_no=%s local_status=%s provider_status=%s", fresh.TradeNo, fresh.ProviderOrderNo, res.localStatus, res.providerStatus))
	}
	switch res.localStatus {
	case common.TopUpStatusSuccess, common.TopUpStatusFailed, common.TopUpStatusExpired:
		return true
	}
	return false
}
