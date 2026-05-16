package model

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createPlaygroundFoodForTest(t *testing.T, food *UIPlaygroundFood) {
	t.Helper()
	require.NoError(t, CreateUIPlaygroundFood(food))
}

func TestListUIPlaygroundFoodsIncludesApprovedPublicAndOwnPrivate(t *testing.T) {
	truncateTables(t)

	createPlaygroundFoodForTest(t, &UIPlaygroundFood{
		Name:        "Public Approved",
		Description: "public item",
		Category:    "rice",
		Status:      UIPlaygroundFoodStatusApproved,
		Visibility:  UIPlaygroundFoodVisibilityPublic,
		Source:      UIPlaygroundFoodSourceUser,
		SubmittedBy: 1,
	})
	createPlaygroundFoodForTest(t, &UIPlaygroundFood{
		Name:        "Public Pending",
		Description: "pending item",
		Category:    "rice",
		Status:      UIPlaygroundFoodStatusPending,
		Visibility:  UIPlaygroundFoodVisibilityPublic,
		Source:      UIPlaygroundFoodSourceUser,
		SubmittedBy: 1,
	})
	createPlaygroundFoodForTest(t, &UIPlaygroundFood{
		Name:        "Own Private",
		Description: "private item",
		Category:    "noodles",
		Status:      UIPlaygroundFoodStatusApproved,
		Visibility:  UIPlaygroundFoodVisibilityPrivate,
		Source:      UIPlaygroundFoodSourceUser,
		SubmittedBy: 7,
	})
	createPlaygroundFoodForTest(t, &UIPlaygroundFood{
		Name:        "Other Private",
		Description: "other private item",
		Category:    "noodles",
		Status:      UIPlaygroundFoodStatusApproved,
		Visibility:  UIPlaygroundFoodVisibilityPrivate,
		Source:      UIPlaygroundFoodSourceUser,
		SubmittedBy: 8,
	})

	foods, err := ListUIPlaygroundFoods(7)
	require.NoError(t, err)

	names := make([]string, 0, len(foods))
	for _, food := range foods {
		names = append(names, food.Name)
	}
	assert.ElementsMatch(t, []string{"Public Approved", "Own Private"}, names)
}

func TestDeletePrivateUIPlaygroundFoodOnlyDeletesOwnerItem(t *testing.T) {
	truncateTables(t)

	createPlaygroundFoodForTest(t, &UIPlaygroundFood{
		Name:        "Owned Private",
		Description: "private item",
		Category:    "snack",
		Status:      UIPlaygroundFoodStatusApproved,
		Visibility:  UIPlaygroundFoodVisibilityPrivate,
		Source:      UIPlaygroundFoodSourceUser,
		SubmittedBy: 7,
	})

	var food UIPlaygroundFood
	require.NoError(t, DB.Where("name = ?", "Owned Private").First(&food).Error)
	require.NoError(t, DeletePrivateUIPlaygroundFood(food.Id, 8))

	views, err := ListUIPlaygroundFoods(7)
	require.NoError(t, err)
	require.Len(t, views, 1)

	require.NoError(t, DeletePrivateUIPlaygroundFood(food.Id, 7))
	views, err = ListUIPlaygroundFoods(7)
	require.NoError(t, err)
	assert.Empty(t, views)
}
