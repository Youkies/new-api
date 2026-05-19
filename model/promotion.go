package model

import (
	"github.com/QuantumNous/new-api/common"
)

// CountPromotionSkuSold 返回某 SKU 已成功售出的总数。pending / failed / refunded
// 不计入，因为可能后续取消；只有 status=success 才占用配额。
func CountPromotionSkuSold(skuID string) (int64, error) {
	if skuID == "" {
		return 0, nil
	}
	var n int64
	err := DB.Model(&TopUp{}).
		Where("promotion_sku_id = ? AND status = ?", skuID, common.TopUpStatusSuccess).
		Count(&n).Error
	return n, err
}

// CountPromotionSkuSoldBatch 一次返回多 SKU 销量（首页 SKU 网格用）。返回 map[skuID]count。
func CountPromotionSkuSoldBatch(skuIDs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(skuIDs))
	if len(skuIDs) == 0 {
		return out, nil
	}
	type row struct {
		PromotionSkuId string
		C              int64
	}
	var rows []row
	err := DB.Model(&TopUp{}).
		Select("promotion_sku_id, COUNT(*) AS c").
		Where("promotion_sku_id IN ? AND status = ?", skuIDs, common.TopUpStatusSuccess).
		Group("promotion_sku_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.PromotionSkuId] = r.C
	}
	for _, id := range skuIDs {
		if _, ok := out[id]; !ok {
			out[id] = 0
		}
	}
	return out, nil
}

// CountUserPromotionSkuPurchases 返回某用户在某 SKU 上的购买次数。
func CountUserPromotionSkuPurchases(userID int, skuID string) (int64, error) {
	if userID == 0 || skuID == "" {
		return 0, nil
	}
	var n int64
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND promotion_sku_id = ? AND status = ?", userID, skuID, common.TopUpStatusSuccess).
		Count(&n).Error
	return n, err
}

// CountUserPromotionSkuPurchasesBatch 一次返回某用户在多个 SKU 上的购买计数。
func CountUserPromotionSkuPurchasesBatch(userID int, skuIDs []string) (map[string]int64, error) {
	out := make(map[string]int64, len(skuIDs))
	if userID == 0 || len(skuIDs) == 0 {
		return out, nil
	}
	type row struct {
		PromotionSkuId string
		C              int64
	}
	var rows []row
	err := DB.Model(&TopUp{}).
		Select("promotion_sku_id, COUNT(*) AS c").
		Where("user_id = ? AND promotion_sku_id IN ? AND status = ?", userID, skuIDs, common.TopUpStatusSuccess).
		Group("promotion_sku_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.PromotionSkuId] = r.C
	}
	for _, id := range skuIDs {
		if _, ok := out[id]; !ok {
			out[id] = 0
		}
	}
	return out, nil
}

// CountUserPromotionPendingSkuPurchases 返回用户在某 SKU 上还没付款的 pending 单数。
// 用于"用户已有未支付订单"提示 / 防止刷预占。
func CountUserPromotionPendingSkuPurchases(userID int, skuID string) (int64, error) {
	if userID == 0 || skuID == "" {
		return 0, nil
	}
	var n int64
	err := DB.Model(&TopUp{}).
		Where("user_id = ? AND promotion_sku_id = ? AND status = ?", userID, skuID, common.TopUpStatusPending).
		Count(&n).Error
	return n, err
}
