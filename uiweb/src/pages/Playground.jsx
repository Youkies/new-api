import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Dices,
  Gamepad2,
  History,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  createPrivatePlaygroundFood,
  deletePrivatePlaygroundFood,
  listPlaygroundFoods,
  submitPlaygroundFood,
} from '../services/playgroundFoods.js'

const CUSTOM_FOODS_KEY = 'uiweb.playground.whatToEat.customFoods'
const HISTORY_KEY = 'uiweb.playground.whatToEat.history'

const CATEGORIES = [
  { value: 'all', label: '全部', icon: '✨' },
  { value: 'breakfast', label: '早餐', icon: '🌤️' },
  { value: 'rice', label: '盖饭', icon: '🍚' },
  { value: 'noodles', label: '粉面', icon: '🍜' },
  { value: 'spicy', label: '麻辣', icon: '🔥' },
  { value: 'global', label: '异国', icon: '🌏' },
  { value: 'snack', label: '夜宵', icon: '🌙' },
  { value: 'dessert', label: '甜品', icon: '🍰' },
  { value: 'drink', label: '饮品', icon: '🥤' },
]

const CATEGORY_OPTIONS = CATEGORIES.filter((item) => item.value !== 'all').map((item) => ({
  value: item.value,
  label: `${item.icon} ${item.label}`,
}))

const CATEGORY_ALIASES = {
  hot: 'spicy',
  chinese: 'rice',
  foreign: 'global',
  light: 'breakfast',
  late: 'snack',
  adventure: 'snack',
}

const COMMUNITY_FOOD_META = {
  breakfast: { icon: '🌤️', description: '来自大家的早午餐灵感，轻松开吃' },
  rice: { icon: '🍚', description: '认真吃一顿饭，今天就选它' },
  noodles: { icon: '🍜', description: '粉面一碗，选择困难先交给热汤和碳水' },
  spicy: { icon: '🔥', description: '香辣热闹，适合想吃得有存在感的时候' },
  global: { icon: '🌏', description: '换个口味，今天让世界菜单救场' },
  snack: { icon: '🌙', description: '小吃夜宵候选，快乐来得很快' },
  dessert: { icon: '🍰', description: '甜一点，给今天补一口漂亮心情' },
  drink: { icon: '🥤', description: '先喝一口，脑袋和心情都缓一缓' },
}

const COMMUNITY_FOODS = [
  ['菠萝油', 'breakfast'],
  ['虾饺', 'breakfast'],
  ['华夫饼', 'breakfast'],
  ['班尼迪克蛋', 'breakfast'],
  ['肠粉', 'breakfast'],
  ['蛋挞', 'breakfast'],
  ['早茶点心', 'breakfast'],
  ['小笼包', 'breakfast'],
  ['葱油饼', 'breakfast'],
  ['可颂', 'breakfast'],
  ['法棍', 'breakfast'],
  ['蒸蛋', 'breakfast'],
  ['吐司', 'breakfast'],
  ['蛋堡', 'breakfast'],

  ['啫啫煲', 'rice'],
  ['煲仔饭', 'rice'],
  ['烧鹅', 'rice'],
  ['叉烧饭', 'rice'],
  ['避风塘炒蟹', 'rice'],
  ['雪霁羹', 'rice'],
  ['子龙脱袍', 'rice'],
  ['蟠桃饭', 'rice'],
  ['绵羊盖被', 'rice'],
  ['扬州炒饭', 'rice'],
  ['奶汤锅子鱼', 'rice'],
  ['怀抱鲤', 'rice'],
  ['糯米八宝鸭', 'rice'],
  ['白切鸡', 'rice'],
  ['锅包肉', 'rice'],
  ['啤酒鸭', 'rice'],
  ['芋头焖鸡', 'rice'],
  ['豉油鹅肠', 'rice'],
  ['醋血鸭', 'rice'],
  ['茄汁大虾', 'rice'],
  ['江西小炒', 'rice'],
  ['麻婆豆腐', 'rice'],
  ['回锅肉', 'rice'],
  ['宫保鸡丁', 'rice'],
  ['北京烤鸭', 'rice'],
  ['饺子', 'rice'],
  ['红烧肉', 'rice'],
  ['炒饭', 'rice'],
  ['糖醋里脊', 'rice'],
  ['农家一碗香', 'rice'],
  ['梅菜扣肉', 'rice'],
  ['辣子鸡丁', 'rice'],
  ['粉丝虾仁', 'rice'],
  ['番茄炒蛋', 'rice'],
  ['清蒸鱼', 'rice'],
  ['咖喱鸡饭', 'rice'],
  ['卤肉饭', 'rice'],
  ['蟹黄拌饭', 'rice'],
  ['香煎三文鱼', 'rice'],
  ['粉蒸肉', 'rice'],
  ['辣椒炒肉', 'rice'],
  ['毛氏五花肉', 'rice'],
  ['鱼汤泡饭', 'rice'],
  ['酱板鸭', 'rice'],
  ['锅巴饭', 'rice'],
  ['小炒黄牛肉', 'rice'],
  ['肉丸鸡蛋汤', 'rice'],
  ['酸辣土豆丝', 'rice'],
  ['地三鲜', 'rice'],
  ['咸肉菜饭', 'rice'],
  ['猪脚饭', 'rice'],
  ['烧鸭饭', 'rice'],
  ['烧鹅饭', 'rice'],
  ['三文鱼鹅肝饭', 'rice'],
  ['甜虾拌饭', 'rice'],
  ['温泉蛋牛肉饭', 'rice'],
  ['跷脚牛肉', 'rice'],
  ['鲜烧牛肉', 'rice'],
  ['糖醋排骨', 'rice'],
  ['可乐鸡翅', 'rice'],
  ['鱼香肉丝', 'rice'],
  ['蜜汁鸡翅', 'rice'],
  ['烤全鸡', 'rice'],
  ['苦瓜炒蛋', 'rice'],
  ['东北地锅鸡', 'rice'],
  ['烤三文鱼头加小土豆', 'rice'],
  ['娃娃菜', 'rice'],

  ['云吞面', 'noodles'],
  ['车仔面', 'noodles'],
  ['干炒牛河', 'noodles'],
  ['朝鲜冷面', 'noodles'],
  ['拉面', 'noodles'],
  ['乌冬', 'noodles'],
  ['荞麦面', 'noodles'],
  ['担担面', 'noodles'],
  ['越南河粉', 'noodles'],
  ['冷面', 'noodles'],
  ['鸭血粉丝汤', 'noodles'],
  ['蟹黄捞面', 'noodles'],
  ['盖码粉', 'noodles'],
  ['米线', 'noodles'],
  ['土豆粉', 'noodles'],

  ['菌子火锅', 'spicy'],
  ['田螺鸭脚煲', 'spicy'],
  ['红汤火锅', 'spicy'],
  ['水煮鱼', 'spicy'],
  ['夫妻肺片', 'spicy'],
  ['火锅', 'spicy'],
  ['酸菜鱼', 'spicy'],
  ['辣子鸡', 'spicy'],
  ['芝士年糕鸡', 'spicy'],
  ['部队火锅', 'spicy'],
  ['辣炒年糕', 'spicy'],
  ['凤爪', 'spicy'],
  ['虾滑', 'spicy'],
  ['烤脑花', 'spicy'],
  ['干锅牛蛙', 'spicy'],
  ['肥牛卷', 'spicy'],
  ['肉蟹煲', 'spicy'],
  ['冒烤鸭', 'spicy'],
  ['麻辣烫', 'spicy'],
  ['炸串', 'spicy'],
  ['现捞', 'spicy'],
  ['曹氏鸭脖', 'spicy'],
  ['鸭脖', 'spicy'],
  ['小龙虾', 'spicy'],
  ['干锅鱿鱼', 'spicy'],
  ['宽粉', 'spicy'],
  ['鸭血', 'spicy'],
  ['鱼片', 'spicy'],
  ['鱼籽福袋', 'spicy'],
  ['鸭肠', 'spicy'],
  ['竹荪虾滑卷', 'spicy'],

  ['唐扬炸鸡', 'global'],
  ['天妇罗', 'global'],
  ['刺身拼盘', 'global'],
  ['汉堡', 'global'],
  ['热狗', 'global'],
  ['BBQ猪肋排', 'global'],
  ['BBQ牛胸肉', 'global'],
  ['南方炸鸡', 'global'],
  ['纽约牛排', 'global'],
  ['龙虾卷', 'global'],
  ['凯撒沙拉', 'global'],
  ['通心粉芝士', 'global'],
  ['克拉姆浓汤', 'global'],
  ['BLT三明治', 'global'],
  ['鲁本三明治', 'global'],
  ['水牛城鸡翅', 'global'],
  ['烤芝士三明治', 'global'],
  ['那不勒斯披萨', 'global'],
  ['千层面', 'global'],
  ['意式烩饭 Risotto', 'global'],
  ['帕尼尼', 'global'],
  ['寿司', 'global'],
  ['刺身', 'global'],
  ['烤鸡串', 'global'],
  ['咖喱饭', 'global'],
  ['饭团', 'global'],
  ['味噌汤', 'global'],
  ['章鱼烧', 'global'],
  ['冬阴功', 'global'],
  ['泰式炒河粉', 'global'],
  ['绿咖喱', 'global'],
  ['红咖喱', 'global'],
  ['青木瓜沙拉', 'global'],
  ['泰式炒饭', 'global'],
  ['法棍三明治', 'global'],
  ['春卷', 'global'],
  ['韩式烤肉', 'global'],
  ['泡菜', 'global'],
  ['紫菜包饭', 'global'],
  ['鹅肝', 'global'],
  ['法式蜗牛', 'global'],
  ['马赛鱼汤', 'global'],
  ['寿喜烧', 'global'],
  ['披萨', 'global'],
  ['滨寿司', 'global'],

  ['肯德基疯狂星期四', 'snack'],
  ['辣条', 'snack'],
  ['炸鸡', 'snack'],
  ['薯条', 'snack'],
  ['凉粉', 'snack'],
  ['老式炸鸡（干炸）', 'snack'],
  ['隔壁家的小孩', 'snack', '🎭', '整蛊彩蛋：抽到就去问问隔壁小孩今天想吃啥，不是真的菜单'],
  ['淀粉肠', 'snack'],
  ['烤冷面', 'snack'],
  ['肯德基', 'snack'],
  ['塔斯汀汉堡', 'snack'],
  ['烤肉', 'snack'],

  ['蟹酿橙', 'dessert'],
  ['苹果派', 'dessert'],
  ['布朗尼', 'dessert'],
  ['芝士蛋糕', 'dessert'],
  ['甜甜圈', 'dessert'],
  ['提拉米苏', 'dessert'],
  ['大福', 'dessert'],
  ['铜锣烧', 'dessert'],
  ['马卡龙', 'dessert'],
  ['闪电泡芙', 'dessert'],
  ['可丽露', 'dessert'],
  ['舒芙蕾', 'dessert'],
  ['焦糖布丁', 'dessert'],
  ['芒果糯米饭', 'dessert'],
  ['李若桃酸奶', 'dessert'],

  ['泰式奶茶', 'drink'],
  ['全冰去水小黄油美式', 'drink'],
].map(([name, category, icon, description]) => {
  const meta = COMMUNITY_FOOD_META[category] || COMMUNITY_FOOD_META.snack
  return {
    id: `community-${name}`,
    name,
    description: description || meta.description,
    category,
    icon: icon || meta.icon,
  }
})

const DEFAULT_FOODS = [
  { id: 'yogurt-fruit-nut-bowl', name: '酸奶水果坚果碗', description: '清爽、有甜味，也有一点饱腹感', category: 'breakfast', icon: '🥣' },
  { id: 'avocado-toast-poached-egg', name: '牛油果全麦吐司 + 水波蛋', description: '柔软、轻盈，适合慢慢开始一天', category: 'breakfast', icon: '🥑' },
  { id: 'purple-sweet-potato-oat-bowl', name: '紫薯燕麦碗 + 坚果蜂蜜', description: '暖暖的碳水和坚果香气', category: 'breakfast', icon: '🍠' },
  { id: 'hand-pancake-soy-milk', name: '手抓饼 + 豆浆', description: '热乎、顺手，赶时间也能吃好', category: 'breakfast', icon: '🥞' },
  { id: 'jianbing-guozi-breakfast', name: '煎饼果子', description: '早餐摊的确定感', category: 'breakfast', icon: '🌯' },
  { id: 'egg-custard-xiaolongbao', name: '鸡蛋羹 + 小笼包', description: '软乎乎的一组，胃会很满意', category: 'breakfast', icon: '🥚' },
  { id: 'matcha-latte-cake', name: '抹茶拿铁 + 小蛋糕', description: '早午餐也可以有一点精致甜', category: 'breakfast', icon: '🍵' },
  { id: 'rainbow-fruit-salad-yogurt', name: '彩虹水果沙拉 + 希腊酸奶', description: '颜色先把心情点亮', category: 'breakfast', icon: '🍓' },
  { id: 'avocado-egg-sandwich', name: '牛油果鸡蛋三明治', description: '清爽但不空，适合继续工作', category: 'breakfast', icon: '🥪' },
  { id: 'cheese-corn-chips-fruit', name: '芝士玉米片 + 水果', description: '脆脆甜甜，适合轻松一点的早午餐', category: 'breakfast', icon: '🧀' },

  { id: 'braised-chicken-rice', name: '黄焖鸡米饭', description: '汤汁拌饭很稳，一份就够', category: 'rice', icon: '🍛' },
  { id: 'kung-pao-chicken-rice', name: '宫保鸡丁饭', description: '酸甜微辣，米饭搭档', category: 'rice', icon: '🍚' },
  { id: 'fish-fragrant-pork-rice', name: '鱼香肉丝饭', description: '酸甜下饭，经典不出错', category: 'rice', icon: '🍚' },
  { id: 'twice-cooked-pork-rice', name: '回锅肉饭', description: '香辣有锅气，适合饿的时候', category: 'rice', icon: '🥓' },
  { id: 'mapo-tofu-rice', name: '麻婆豆腐饭', description: '麻辣鲜香，下饭很稳', category: 'rice', icon: '🌶️' },
  { id: 'vegetable-rice-bowl', name: '时蔬盖浇饭', description: '简单清爽，给身体一点绿色', category: 'rice', icon: '🥬' },

  { id: 'luosifen', name: '螺蛳粉', description: '非常有存在感的一餐', category: 'noodles', icon: '🍜' },
  { id: 'lanzhou-beef-noodle', name: '兰州牛肉面', description: '热汤、面条、今天先被安抚一下', category: 'noodles', icon: '🍜' },
  { id: 'chongqing-noodle', name: '重庆小面', description: '麻辣鲜香，越拌越有精神', category: 'noodles', icon: '🍜' },
  { id: 'hot-dry-noodle', name: '热干面', description: '芝麻酱浓郁，适合认真嗦面', category: 'noodles', icon: '🥢' },
  { id: 'guilin-rice-noodle', name: '桂林米粉', description: '卤水香，米粉滑，吃完很满足', category: 'noodles', icon: '🍜' },

  { id: 'malatang-vegetable', name: '麻辣烫（自选多蔬版）', description: '想吃什么都能放一点，蔬菜多一点更安心', category: 'spicy', icon: '🍢' },
  { id: 'chuanchuan', name: '串串香', description: '小串很多，选择感拉满', category: 'spicy', icon: '🍢' },
  { id: 'solo-hotpot', name: '一人小火锅', description: '一个人也能郑重其事地开锅', category: 'spicy', icon: '🥘' },
  { id: 'maocai', name: '冒菜', description: '像火锅，但更快抵达饭桌', category: 'spicy', icon: '🔥' },

  { id: 'korean-bibimbap', name: '韩式石锅拌饭', description: '拌开以后世界就有秩序了', category: 'global', icon: '🍚' },
  { id: 'japanese-ramen', name: '日式拉面', description: '汤浓一点，心情也浓一点', category: 'global', icon: '🍜' },
  { id: 'sushi-platter', name: '寿司拼盘', description: '清爽一点，也算认真吃饭', category: 'global', icon: '🍣' },
  { id: 'korean-fried-chicken', name: '韩式炸鸡', description: '外脆里嫩，快乐很直接', category: 'global', icon: '🍗' },
  { id: 'rainbow-poke-bowl', name: '彩虹poke bowl', description: '轻盈、漂亮，碗里有海风', category: 'global', icon: '🥗' },
  { id: 'caesar-salad-bowl', name: '凯撒沙拉碗', description: '清爽但有存在感', category: 'global', icon: '🥗' },
  { id: 'avocado-chicken-salad', name: '牛油果鸡胸沙拉', description: '轻一点，但别太委屈自己', category: 'global', icon: '🥑' },
  { id: 'tomato-pasta', name: '番茄意面', description: '酸甜热乎，适合想吃西式的时候', category: 'global', icon: '🍝' },
  { id: 'grilled-fish', name: '烤鱼', description: '热闹、入味，适合奖励自己', category: 'global', icon: '🐟' },
  { id: 'bobo-chicken', name: '钵钵鸡', description: '四川乐山风味，冷串也可以很有仪式感', category: 'spicy', icon: '🍢' },

  { id: 'fried-chicken-flavors', name: '炸鸡（各种口味）', description: '今天让酥脆来做决定', category: 'snack', icon: '🍗' },
  { id: 'bbq-skewers', name: '烤串', description: '夜色越深越合理', category: 'snack', icon: '🍖' },
  { id: 'oden', name: '关东煮', description: '汤热热的，适合慢慢吃', category: 'snack', icon: '🍢' },
  { id: 'stinky-tofu', name: '臭豆腐', description: '香和臭之间有一条快乐小路', category: 'snack', icon: '🧆' },
  { id: 'chicken-cutlet', name: '鸡排', description: '大块、香脆、很有安全感', category: 'snack', icon: '🍗' },
  { id: 'hand-pancake-snack', name: '手抓饼', description: '夜宵也能快速有着落', category: 'snack', icon: '🥞' },
  { id: 'jianbing-guozi-snack', name: '煎饼果子', description: '什么时候吃都像刚出摊', category: 'snack', icon: '🌯' },

  { id: 'mango-pomelo-sago', name: '杨枝甘露', description: '芒果和西柚把甜度调得刚好', category: 'dessert', icon: '🥭' },
  { id: 'mango-pancake', name: '芒果班戟', description: '软软甜甜，适合下午茶', category: 'dessert', icon: '🥭' },
  { id: 'rainbow-mille-crepe', name: '彩虹千层蛋糕', description: '漂亮本身也是一种口味', category: 'dessert', icon: '🍰' },
  { id: 'mini-cake', name: '精致小蛋糕', description: '小小一块，认真快乐', category: 'dessert', icon: '🧁' },
  { id: 'ice-cream', name: '冰淇淋', description: '清凉甜蜜，适合把脑袋降温', category: 'dessert', icon: '🍦' },
  { id: 'pudding', name: '布丁', description: '软滑、轻甜、没有攻击性', category: 'dessert', icon: '🍮' },
  { id: 'guilinggao', name: '龟苓膏', description: '清清凉凉，甜度自己掌控', category: 'dessert', icon: '🍯' },
  { id: 'roasted-sweet-potato', name: '烤红薯', description: '热乎乎的甜，适合冬天也适合夜晚', category: 'dessert', icon: '🍠' },

  { id: 'cheese-milk-tea', name: '芝士奶茶', description: '咸甜奶盖，快乐很厚', category: 'drink', icon: '🧋' },
  { id: 'taro-bobo-milk-tea', name: '芋泥波波奶茶', description: '糯叽叽爱好者集合', category: 'drink', icon: '🧋' },
  { id: 'strawberry-milk-tea', name: '草莓奶茶', description: '粉色、甜香、心情友好', category: 'drink', icon: '🍓' },
  { id: 'lemon-tea', name: '柠檬茶', description: '酸爽提神，适合下午犯困', category: 'drink', icon: '🍋' },
  { id: 'passion-fruit-tea', name: '百香果茶', description: '果香很亮，适合解腻', category: 'drink', icon: '🥤' },
  { id: 'pharmacy-plum-drink', name: '药房酸梅汤', description: '复古酸甜，越喝越顺', category: 'drink', icon: '🫙' },
  { id: 'americano', name: '美式咖啡', description: '直接、清醒、继续干活', category: 'drink', icon: '☕' },
  { id: 'latte', name: '拿铁', description: '咖啡和牛奶的温柔折中', category: 'drink', icon: '☕' },
  { id: 'matcha-latte', name: '抹茶拿铁', description: '茶香奶香，适合慢下来一点', category: 'drink', icon: '🍵' },
  { id: 'lemon-honey-water', name: '柠檬蜂蜜水', description: '清润一点，给嗓子放个假', category: 'drink', icon: '🍯' },

  ...COMMUNITY_FOODS,
]

const PLAYGROUND_GAMES = [
  {
    id: 'what-to-eat',
    label: '今天吃什么呀',
    subtitle: '随机开吃',
    icon: UtensilsCrossed,
    enabled: true,
    badge: '已上线',
  },
  {
    id: 'lucky-dice',
    label: '幸运骰子',
    subtitle: '随机点数',
    icon: Dices,
    enabled: false,
    badge: '待加入',
  },
  {
    id: 'daily-spark',
    label: '灵感抽签',
    subtitle: '随机提示',
    icon: Sparkles,
    enabled: false,
    badge: '待加入',
  },
]

function safeRead(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch (_) {
    return fallback
  }
}

function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (_) {}
}

function randomIndex(length) {
  if (length <= 1) return 0
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const value = new Uint32Array(1)
    window.crypto.getRandomValues(value)
    return value[0] % length
  }
  return Math.floor(Math.random() * length)
}

function pickOne(list, previousId) {
  if (!list.length) return null
  if (list.length === 1) return list[0]
  let item = list[randomIndex(list.length)]
  if (item.id === previousId) {
    item = list[(list.findIndex((food) => food.id === item.id) + 1) % list.length]
  }
  return item
}

function isToday(ts) {
  if (!ts) return false
  const d = new Date(ts)
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}

function categoryLabel(value) {
  return CATEGORIES.find((item) => item.value === value)?.label || '自定义'
}

function normalizeFood(item) {
  if (!item || typeof item !== 'object') return item
  return {
    ...item,
    category: CATEGORY_ALIASES[item.category] || item.category || 'breakfast',
  }
}

function normalizeRemoteFood(item) {
  if (!item || typeof item !== 'object') return null
  const visibility = item.visibility || 'public'
  return normalizeFood({
    id: `${visibility}-${item.id}`,
    remoteId: item.id,
    name: item.name,
    description: item.description || (visibility === 'private' ? '这是你的私人菜单' : '来自公共菜品池'),
    category: item.category || 'breakfast',
    icon: item.icon || '🍽️',
    imageUrl: item.image_url || '',
    status: item.status,
    visibility,
    server: true,
    custom: visibility === 'private',
  })
}

function FoodVisual({ food, size = 'lg', className = '' }) {
  const sizeClass = size === 'sm'
    ? 'h-10 w-10 text-xl'
    : 'h-28 w-28 text-5xl sm:h-44 sm:w-44 sm:text-7xl'
  const shadowClass = size === 'sm' ? 'shadow-clay-sm' : 'shadow-clay'
  if (food?.imageUrl) {
    return (
      <div className={`overflow-hidden rounded-full bg-clay-pink-100 ${shadowClass} ${sizeClass} ${className}`}>
        <img src={food.imageUrl} alt={food.name || 'food'} className="h-full w-full object-cover" />
      </div>
    )
  }
  return (
    <div className={`flex items-center justify-center rounded-full bg-clay-pink-100 ${shadowClass} ${sizeClass} ${className}`}>
      <span aria-hidden="true">{food?.icon || '🍽️'}</span>
    </div>
  )
}

function WhatToEatGame() {
  const toast = useToast()
  const rollTimer = useRef(null)
  const finishTimer = useRef(null)
  const [category, setCategory] = useState('all')
  const [customFoods, setCustomFoods] = useState(() => safeRead(CUSTOM_FOODS_KEY, []).map(normalizeFood))
  const [serverFoods, setServerFoods] = useState([])
  const [history, setHistory] = useState(() => safeRead(HISTORY_KEY, []).map(normalizeFood))
  const [current, setCurrent] = useState(DEFAULT_FOODS[0])
  const [rolling, setRolling] = useState(false)
  const [serverLoading, setServerLoading] = useState(false)
  const [savingCustom, setSavingCustom] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', category: 'breakfast', image: null, imagePreview: '' })
  const [submitForm, setSubmitForm] = useState({ name: '', description: '', category: 'breakfast', image: null, imagePreview: '' })

  const foods = useMemo(() => [...DEFAULT_FOODS, ...serverFoods, ...customFoods], [customFoods, serverFoods])
  const privateFoods = useMemo(
    () => [
      ...serverFoods.filter((item) => item.visibility === 'private'),
      ...customFoods,
    ],
    [customFoods, serverFoods],
  )
  const filteredFoods = useMemo(() => {
    if (category === 'all') return foods
    return foods.filter((item) => item.category === category)
  }, [category, foods])
  const todayHistory = useMemo(() => history.filter((item) => isToday(item.at)).slice(0, 8), [history])

  const refreshServerFoods = useCallback(async () => {
    setServerLoading(true)
    try {
      const res = await listPlaygroundFoods()
      if (res?.success === false) throw new Error(res.message || '菜品池加载失败')
      const items = res?.data?.items ?? res?.data ?? []
      setServerFoods(Array.isArray(items) ? items.map(normalizeRemoteFood).filter(Boolean) : [])
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '服务器菜单加载失败，先使用本地菜单', 'warning')
    } finally {
      setServerLoading(false)
    }
  }, [toast])

  useEffect(() => {
    safeWrite(CUSTOM_FOODS_KEY, customFoods)
  }, [customFoods])

  useEffect(() => {
    refreshServerFoods()
  }, [refreshServerFoods])

  useEffect(() => {
    safeWrite(HISTORY_KEY, history.slice(0, 30))
  }, [history])

  useEffect(() => {
    if (filteredFoods.length && !filteredFoods.some((item) => item.id === current?.id)) {
      setCurrent(filteredFoods[0])
    }
  }, [current?.id, filteredFoods])

  useEffect(() => () => {
    if (rollTimer.current) window.clearInterval(rollTimer.current)
    if (finishTimer.current) window.clearTimeout(finishTimer.current)
  }, [])

  const closeCustom = () => {
    setCustomOpen(false)
    setForm({ name: '', description: '', category: 'breakfast', image: null, imagePreview: '' })
  }

  const closeSubmit = () => {
    setSubmitOpen(false)
    setSubmitForm({ name: '', description: '', category: 'breakfast', image: null, imagePreview: '' })
  }

  const handleImageChange = (file, setter) => {
    if (!file) {
      setter((prev) => ({ ...prev, image: null, imagePreview: '' }))
      return
    }
    if (!file.type?.startsWith('image/')) {
      toast('请选择图片文件', 'error')
      return
    }
    if (file.size > 800 * 1024) {
      toast('图片不能超过 800KB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setter((prev) => ({ ...prev, image: file, imagePreview: reader.result || '' }))
    reader.readAsDataURL(file)
  }

  const roll = useCallback(() => {
    if (!filteredFoods.length) {
      toast('这个分类还没有食物，可以先加一个自定义', 'info')
      return
    }
    if (rollTimer.current) window.clearInterval(rollTimer.current)
    if (finishTimer.current) window.clearTimeout(finishTimer.current)

    setRolling(true)
    rollTimer.current = window.setInterval(() => {
      setCurrent(filteredFoods[randomIndex(filteredFoods.length)])
    }, 70)

    finishTimer.current = window.setTimeout(() => {
      window.clearInterval(rollTimer.current)
      rollTimer.current = null
      const finalFood = pickOne(filteredFoods, current?.id)
      setCurrent(finalFood)
      setHistory((prev) => [
        { ...finalFood, at: Date.now() },
        ...prev,
      ].slice(0, 30))
      setRolling(false)
    }, 900)
  }, [current?.id, filteredFoods, toast])

  const addCustomFood = async () => {
    const name = form.name.trim()
    const description = form.description.trim()
    if (!name) {
      toast('先写一个食物名称', 'error')
      return
    }
    setSavingCustom(true)
    try {
      const res = await createPrivatePlaygroundFood({
        name,
        description: description || '这是你的私人菜单',
        category: form.category || 'breakfast',
        icon: '🍽️',
        image: form.image,
      })
      if (res?.success === false) throw new Error(res.message || '保存失败')
      const nextFood = normalizeRemoteFood(res?.data)
      if (!nextFood) throw new Error('保存结果无效')
      setServerFoods((prev) => [nextFood, ...prev.filter((item) => item.remoteId !== nextFood.remoteId)])
      setCurrent(nextFood)
      setCategory(nextFood.category)
      closeCustom()
      toast('已保存到我的菜单', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存到服务器失败', 'error')
    } finally {
      setSavingCustom(false)
    }
  }

  const removeCustomFood = async (item) => {
    if (!item) return
    if (item.server && item.remoteId) {
      try {
        const res = await deletePrivatePlaygroundFood(item.remoteId)
        if (res?.success === false) throw new Error(res.message || '删除失败')
        setServerFoods((prev) => prev.filter((food) => food.id !== item.id))
        toast('已从服务器菜单移除', 'info')
      } catch (err) {
        toast(err?.response?.data?.message || err.message || '删除失败', 'error')
      }
      return
    }
    setCustomFoods((prev) => prev.filter((food) => food.id !== item.id))
    toast('已移除本地自定义食物', 'info')
  }

  const submitPublicFood = async () => {
    const name = submitForm.name.trim()
    const description = submitForm.description.trim()
    if (!name) {
      toast('先写一个菜品名称', 'error')
      return
    }
    if (!submitForm.image) {
      toast('投稿需要上传菜品图片', 'error')
      return
    }
    setSubmitting(true)
    try {
      const res = await submitPlaygroundFood({
        name,
        description,
        category: submitForm.category || 'breakfast',
        icon: '🍽️',
        image: submitForm.image,
      })
      if (res?.success === false) throw new Error(res.message || '提交失败')
      closeSubmit()
      toast('已提交审核，通过后会进入公共菜品池', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '提交失败', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const clearHistory = () => {
    setHistory([])
    toast('今日记录已清空', 'info')
  }

  return (
    <>
      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ClayCard className="relative !p-4 sm:!p-8">
          <div className="mb-4 flex flex-col gap-3 md:mb-6 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-clay-pill bg-clay-pink-100 px-3 py-1.5 text-xs font-black text-clay-pink-ink shadow-clay-sm sm:mb-3 sm:px-4 sm:py-2 sm:text-sm">
                <UtensilsCrossed className="h-4 w-4" strokeWidth={2.6} />
                今天吃什么呀
              </div>
              <h2 className="text-xl font-black tracking-tight sm:text-3xl">选择困难救星</h2>
              <p className="mt-1 text-xs font-bold text-clay-faint sm:mt-2 sm:text-sm">
                已准备 {filteredFoods.length} 个候选{serverLoading ? '，服务器菜单同步中' : ''}
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-clay-pill bg-clay-bg px-4 py-2 text-sm font-black text-clay-faint shadow-clay-inset sm:flex">
              <Gamepad2 className="h-4 w-4" />
              Playground
            </div>
          </div>

          <div className="clay-scrollbar-none mb-4 flex flex-nowrap gap-2 overflow-x-auto py-1 sm:mb-7 sm:flex-wrap sm:gap-3 sm:overflow-visible sm:py-0">
            {CATEGORIES.map((item) => {
              const active = item.value === category
              const count = item.value === 'all'
                ? foods.length
                : foods.filter((food) => food.category === item.value).length
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={`min-h-10 shrink-0 rounded-clay-pill px-4 text-sm font-black transition-all duration-200 ease-clay active:scale-95 sm:min-h-11 ${
                    active
                      ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
                      : 'bg-clay-bg text-clay-ink shadow-clay-inset-sm hover:text-clay-pink-ink'
                  }`}
                >
                  <span className="mr-1.5">{item.icon}</span>
                  {item.label}
                  <span className="ml-2 text-xs opacity-60">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="rounded-[28px] bg-clay-bg p-4 text-center shadow-clay-inset sm:rounded-[32px] sm:p-8">
            <FoodVisual
              food={current}
              className={`mx-auto mb-4 transition-all duration-300 sm:mb-6 ${rolling ? 'scale-95 rotate-3' : ''}`}
            />
            <div className="mx-auto max-w-xl">
              <div className="mb-2 flex items-center justify-center gap-2 sm:mb-3">
                <Sparkles className="h-4 w-4 text-clay-pink-400" strokeWidth={2.8} />
                <span className="text-xs font-black text-clay-faint">{categoryLabel(current?.category)}</span>
              </div>
              <h3 className="break-words text-2xl font-black text-clay-pink-400 sm:text-4xl">
                {current?.name || '还没有结果'}
              </h3>
              <p className="mt-2 break-words text-sm font-bold text-clay-faint sm:mt-3 sm:text-base">
                {current?.description || '先加一点候选菜单'}
              </p>
            </div>

            <div className="mt-6 flex items-stretch justify-center gap-3 sm:mt-8 sm:flex-row sm:flex-wrap">
              <ClayButton type="button" onClick={roll} disabled={rolling} className="w-full sm:w-auto sm:min-w-44">
                <Dices className={`h-5 w-5 ${rolling ? 'animate-spin' : ''}`} strokeWidth={2.8} />
                {rolling ? '挑选中' : '开吃'}
              </ClayButton>
              <ClayButton type="button" variant="secondary" onClick={roll} disabled={rolling} className="hidden sm:inline-flex sm:min-w-40">
                <RefreshCw className="h-4 w-4" strokeWidth={2.8} />
                再来一次
              </ClayButton>
              <ClayButton type="button" variant="ghost" onClick={clearHistory} className="hidden sm:inline-flex sm:min-w-40">
                <Trash2 className="h-4 w-4" strokeWidth={2.8} />
                清空记录
              </ClayButton>
            </div>
          </div>
        </ClayCard>

        <div className="flex flex-col gap-4 sm:gap-6">
          <ClayCard className="!p-4 sm:!p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-clay-pink-400" strokeWidth={2.8} />
                <h3 className="text-lg font-black">今日记录</h3>
              </div>
              <div className="flex items-center gap-2">
                {todayHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="clay-icon-btn text-clay-faint hover:text-clay-pink-400 sm:hidden"
                    aria-label="清空记录"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={2.8} />
                  </button>
                )}
                <span className="rounded-clay-pill bg-clay-bg px-3 py-1 text-xs font-black text-clay-faint shadow-clay-inset">
                  {todayHistory.length}
                </span>
              </div>
            </div>
            {todayHistory.length ? (
              <div className="space-y-3">
                {todayHistory.map((item) => (
                  <div key={`${item.id}-${item.at}`} className="flex items-center gap-3 rounded-[22px] bg-clay-bg px-4 py-3 shadow-clay-inset">
                    <FoodVisual food={item} size="sm" className="shrink-0 !shadow-clay-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{item.name}</div>
                      <div className="truncate text-xs font-bold text-clay-faint">{categoryLabel(item.category)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] bg-clay-bg px-5 py-5 text-center text-sm font-bold text-clay-faint shadow-clay-inset sm:py-7">
                今天还没有开吃记录
              </div>
            )}
          </ClayCard>

          <ClayCard className="!p-4 sm:!p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-clay-green-300" strokeWidth={2.8} />
                <h3 className="text-lg font-black">我的菜单</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSubmitOpen(true)}
                  className="clay-icon-btn text-clay-faint hover:text-clay-pink-400"
                  aria-label="投稿到公共菜品池"
                  title="投稿到公共菜品池"
                >
                  <Send className="h-4 w-4" strokeWidth={2.8} />
                </button>
                <button
                  type="button"
                  onClick={() => setCustomOpen(true)}
                  className="clay-icon-btn"
                  aria-label="添加到我的菜单"
                  title="添加到我的菜单"
                >
                  <Plus className="h-4 w-4" strokeWidth={2.8} />
                </button>
              </div>
            </div>
            {privateFoods.length ? (
              <div className="space-y-3">
                {privateFoods.slice(0, 8).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-[22px] bg-clay-bg px-4 py-3 shadow-clay-inset">
                    <FoodVisual food={item} size="sm" className="shrink-0 !bg-clay-green-100 !shadow-clay-sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-black">{item.name}</div>
                      <div className="truncate text-xs font-bold text-clay-faint">
                        {item.server ? '已同步服务器' : item.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomFood(item)}
                      className="clay-icon-btn text-clay-faint hover:text-clay-pink-400"
                      aria-label={`删除 ${item.name}`}
                    >
                      <X className="h-4 w-4" strokeWidth={2.8} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] bg-clay-bg px-5 py-7 text-center text-sm font-bold text-clay-faint shadow-clay-inset">
                还没有我的菜单
              </div>
            )}
          </ClayCard>
        </div>
      </div>

      <ClayModal
        open={customOpen}
        onClose={closeCustom}
        title="我的菜单"
        size="md"
        footer={(
          <>
            <ClayButton type="button" variant="ghost" onClick={closeCustom}>
              取消
            </ClayButton>
            <ClayButton type="button" onClick={addCustomFood} disabled={savingCustom}>
              {savingCustom ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              保存
            </ClayButton>
          </>
        )}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black">食物名称</span>
            <ClayInput
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：韩式炸酱面"
              maxLength={24}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">描述</span>
            <textarea
              className="clay-input min-h-24 resize-none"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="例如：黑黑的但好吃"
              maxLength={80}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">分类</span>
            <ClaySelect
              value={form.category}
              options={CATEGORY_OPTIONS}
              onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">图片</span>
            <div className="rounded-[24px] bg-clay-bg p-4 shadow-clay-inset">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-clay-surface shadow-clay-sm">
                  {form.imagePreview ? (
                    <img src={form.imagePreview} alt="预览" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-7 w-7 text-clay-faint" strokeWidth={2.6} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => handleImageChange(e.target.files?.[0], setForm)}
                    className="block w-full text-sm font-bold text-clay-faint file:mr-3 file:rounded-clay-pill file:border-0 file:bg-clay-bg file:px-4 file:py-2 file:font-black file:text-clay-ink file:shadow-clay-sm"
                  />
                  <p className="mt-2 text-xs font-bold text-clay-faint">可选，保存后会随你的账号同步。</p>
                </div>
              </div>
            </div>
          </label>
        </div>
      </ClayModal>

      <ClayModal
        open={submitOpen}
        onClose={closeSubmit}
        title="投稿菜品"
        size="md"
        footer={(
          <>
            <ClayButton type="button" variant="ghost" onClick={closeSubmit}>
              取消
            </ClayButton>
            <ClayButton type="button" onClick={submitPublicFood} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              提交审核
            </ClayButton>
          </>
        )}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-black">菜品名称</span>
            <ClayInput
              value={submitForm.name}
              onChange={(e) => setSubmitForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="例如：牛油果鸡蛋三明治"
              maxLength={40}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">描述</span>
            <textarea
              className="clay-input min-h-24 resize-none"
              value={submitForm.description}
              onChange={(e) => setSubmitForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="写一句为什么值得加入公共菜品池"
              maxLength={200}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">分类</span>
            <ClaySelect
              value={submitForm.category}
              options={CATEGORY_OPTIONS}
              onChange={(value) => setSubmitForm((prev) => ({ ...prev, category: value }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-black">菜品图片</span>
            <div className="rounded-[24px] bg-clay-bg p-4 shadow-clay-inset">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-clay-surface shadow-clay-sm">
                  {submitForm.imagePreview ? (
                    <img src={submitForm.imagePreview} alt="预览" className="h-full w-full object-cover" />
                  ) : (
                    <ImagePlus className="h-7 w-7 text-clay-faint" strokeWidth={2.6} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) => handleImageChange(e.target.files?.[0], setSubmitForm)}
                    className="block w-full text-sm font-bold text-clay-faint file:mr-3 file:rounded-clay-pill file:border-0 file:bg-clay-bg file:px-4 file:py-2 file:font-black file:text-clay-ink file:shadow-clay-sm"
                  />
                  <p className="mt-2 text-xs font-bold text-clay-faint">必填，管理员审核后会加入公共菜品池。</p>
                </div>
              </div>
            </div>
          </label>
        </div>
      </ClayModal>
    </>
  )
}

export default function Playground() {
  const { gameId } = useParams()

  if (gameId && gameId !== 'what-to-eat') {
    return <Navigate to="/playground" replace />
  }

  if (gameId === 'what-to-eat') {
    return (
      <ClayConsoleShell
        title="今天吃什么呀"
        subtitle="把选择困难交给骰子"
        compactHeader
        showMembershipBadge={false}
        showAssistantWidget={false}
        actions={(
          <ClayButton as={Link} to="/playground" variant="ghost" className="!px-5">
            <ArrowLeft className="h-4 w-4" strokeWidth={2.8} />
            返回
          </ClayButton>
        )}
      >
        <WhatToEatGame />
      </ClayConsoleShell>
    )
  }

  return (
    <ClayConsoleShell title="游乐场" subtitle="小游戏都放在这里" compactHeader showAssistantWidget={false}>
      <ClayCard className="!p-4 sm:!p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Gamepad2 className="h-5 w-5 text-clay-pink-400" strokeWidth={2.8} />
            <h2 className="truncate text-lg font-black">小游戏列表</h2>
          </div>
          <span className="rounded-clay-pill bg-clay-bg px-3 py-1 text-xs font-black text-clay-faint shadow-clay-inset">
            {PLAYGROUND_GAMES.filter((game) => game.enabled).length}/{PLAYGROUND_GAMES.length}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PLAYGROUND_GAMES.map((game) => {
            const Icon = game.icon
            const cardClass = `block min-h-[92px] rounded-[26px] bg-clay-bg px-4 py-3 text-left text-clay-ink shadow-clay transition-all active:scale-[0.98] ${
              game.enabled ? 'hover:shadow-clay-hover' : 'cursor-not-allowed opacity-60'
            }`
            const content = (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-clay-surface shadow-clay-sm">
                    <Icon className="h-5 w-5" strokeWidth={2.8} />
                  </div>
                  <span className="rounded-clay-pill bg-white/45 px-2.5 py-1 text-[11px] font-black">
                    {game.badge}
                  </span>
                </div>
                <div className="mt-3">
                  <div className="truncate text-base font-black">{game.label}</div>
                  <div className="mt-1 truncate text-xs font-bold opacity-70">{game.subtitle}</div>
                </div>
              </>
            )
            if (game.enabled) {
              return (
                <Link key={game.id} to={`/playground/${game.id}`} className={cardClass}>
                  {content}
                </Link>
              )
            }
            return (
              <button key={game.id} type="button" disabled className={cardClass}>
                {content}
              </button>
            )
          })}
        </div>
      </ClayCard>
    </ClayConsoleShell>
  )
}
