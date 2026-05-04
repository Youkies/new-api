package operation_setting

import "testing"

func cloneCheckinGroupQuotas(src map[string]CheckinQuotaRange) map[string]CheckinQuotaRange {
	if src == nil {
		return nil
	}
	dst := make(map[string]CheckinQuotaRange, len(src))
	for k, v := range src {
		dst[k] = v
	}
	return dst
}

func restoreCheckinSetting(t *testing.T) {
	t.Helper()
	original := checkinSetting
	original.GroupQuotas = cloneCheckinGroupQuotas(checkinSetting.GroupQuotas)
	t.Cleanup(func() {
		checkinSetting = original
	})
}

func TestGetCheckinQuotaRangeForGroup(t *testing.T) {
	restoreCheckinSetting(t)

	checkinSetting.MinQuota = 10
	checkinSetting.MaxQuota = 20
	checkinSetting.GroupQuotas = map[string]CheckinQuotaRange{
		"default":   {MinQuota: 1, MaxQuota: 3},
		"standard优": {MinQuota: 5, MaxQuota: 8},
		"pro优":      {MinQuota: 7, MaxQuota: 10},
		"super优":    {MinQuota: 9, MaxQuota: 12},
		"vip":       {MinQuota: 30, MaxQuota: 40},
	}

	tests := []struct {
		name    string
		group   string
		wantMin int
		wantMax int
	}{
		{name: "exact custom group", group: "vip", wantMin: 30, wantMax: 40},
		{name: "canonical standard group", group: "Standard 优", wantMin: 5, wantMax: 8},
		{name: "canonical pro group", group: "Pro优", wantMin: 7, wantMax: 10},
		{name: "legacy super typo", group: "spuer", wantMin: 9, wantMax: 12},
		{name: "fallback default range", group: "unknown", wantMin: 10, wantMax: 20},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotMin, gotMax := GetCheckinQuotaRangeForGroup(tt.group)
			if gotMin != tt.wantMin || gotMax != tt.wantMax {
				t.Fatalf("GetCheckinQuotaRangeForGroup(%q) = (%d, %d), want (%d, %d)", tt.group, gotMin, gotMax, tt.wantMin, tt.wantMax)
			}
		})
	}
}

func TestParseCheckinGroupQuotasValidation(t *testing.T) {
	if _, err := ParseCheckinGroupQuotas(`{"pro":{"min_quota":10,"max_quota":9}}`); err == nil {
		t.Fatal("expected max < min validation error")
	}
	if _, err := ParseCheckinGroupQuotas(`{"":{"min_quota":1,"max_quota":2}}`); err == nil {
		t.Fatal("expected empty group validation error")
	}
}
