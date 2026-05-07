package setting

import (
	"sync"

	"github.com/QuantumNous/new-api/common"
)

var userUsableGroups = map[string]string{
	"default": "默认分组",
	"vip":     "vip分组",
}
var userUsableGroupsMutex sync.RWMutex

var userUsableGroupDetails = map[string]string{}
var userUsableGroupDetailsMutex sync.RWMutex

func GetUserUsableGroupsCopy() map[string]string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	copyUserUsableGroups := make(map[string]string)
	for k, v := range userUsableGroups {
		copyUserUsableGroups[k] = v
	}
	return copyUserUsableGroups
}

func UserUsableGroups2JSONString() string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	jsonBytes, err := common.Marshal(userUsableGroups)
	if err != nil {
		common.SysLog("error marshalling user groups: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateUserUsableGroupsByJSONString(jsonStr string) error {
	userUsableGroupsMutex.Lock()
	defer userUsableGroupsMutex.Unlock()

	userUsableGroups = make(map[string]string)
	return common.UnmarshalJsonStr(jsonStr, &userUsableGroups)
}

func GetUsableGroupDescription(groupName string) string {
	userUsableGroupsMutex.RLock()
	defer userUsableGroupsMutex.RUnlock()

	if desc, ok := userUsableGroups[groupName]; ok {
		return desc
	}
	return groupName
}

func GetUserUsableGroupDetailsCopy() map[string]string {
	userUsableGroupDetailsMutex.RLock()
	defer userUsableGroupDetailsMutex.RUnlock()

	copyUserUsableGroupDetails := make(map[string]string)
	for k, v := range userUsableGroupDetails {
		copyUserUsableGroupDetails[k] = v
	}
	return copyUserUsableGroupDetails
}

func UserUsableGroupDetails2JSONString() string {
	userUsableGroupDetailsMutex.RLock()
	defer userUsableGroupDetailsMutex.RUnlock()

	jsonBytes, err := common.Marshal(userUsableGroupDetails)
	if err != nil {
		common.SysLog("error marshalling user group details: " + err.Error())
	}
	return string(jsonBytes)
}

func UpdateUserUsableGroupDetailsByJSONString(jsonStr string) error {
	userUsableGroupDetailsMutex.Lock()
	defer userUsableGroupDetailsMutex.Unlock()

	userUsableGroupDetails = make(map[string]string)
	return common.UnmarshalJsonStr(jsonStr, &userUsableGroupDetails)
}

func GetUsableGroupDetailDescription(groupName string) string {
	userUsableGroupDetailsMutex.RLock()
	defer userUsableGroupDetailsMutex.RUnlock()

	if desc, ok := userUsableGroupDetails[groupName]; ok {
		return desc
	}
	return ""
}
