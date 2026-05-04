package model

import "testing"

func TestNormalizeUIPageMembershipBadges(t *testing.T) {
	items := NormalizeUIPageMembershipBadges([]UIPageMembershipBadge{
		{Key: "standard优", Tagline: "标准会员描述"},
		{Key: "pro优", Label: "Pro 定制", ShortLabel: "Pro+", Tagline: "Pro 会员描述"},
	})

	byKey := make(map[string]UIPageMembershipBadge, len(items))
	for _, item := range items {
		byKey[item.Key] = item
	}

	if got := byKey["standard"].Tagline; got != "标准会员描述" {
		t.Fatalf("standard tagline = %q, want %q", got, "标准会员描述")
	}
	if got := byKey["standard"].Label; got != "Standard 优" {
		t.Fatalf("standard label fallback = %q, want %q", got, "Standard 优")
	}
	if got := byKey["pro"].Label; got != "Pro 定制" {
		t.Fatalf("pro label = %q, want %q", got, "Pro 定制")
	}
	if _, ok := byKey["ultra"]; !ok {
		t.Fatal("expected default ultra badge to be preserved")
	}
}
