# 09_MVP阶段性验收与部署清单

版本：V1.0
项目名称：微信点餐小程序
阶段：MVP 阶段性验收
日期：2026-06-17

---

## 一、当前 MVP 已完成能力

1. 首页入口：用户可以从首页进入点餐、我的订单、商家工作台。
2. 菜单浏览：菜单页可以通过 `getMenu` 读取分类和餐品。
3. 餐品详情：餐品详情页可以通过 `getDishDetail` 展示真实餐品数据。
4. 本地购物车：菜单页和详情页可加入购物车，购物车使用本地缓存 `cart_items`。
5. 创建订单：购物车页可调用 `createOrder` 创建真实订单。
6. 用户订单列表：用户可通过 `getUserOrders` 查看自己的订单。
7. 用户订单详情：用户可通过 `getOrderDetail` 查看自己的订单详情。
8. 商家订单列表：商家可通过 `getMerchantOrders` 查看本店订单。
9. 商家订单详情：商家可通过 `getMerchantOrderDetail` 查看本店单笔订单详情。
10. 商家接单：商家可将订单从 `pending` 更新为 `accepted`。
11. 商家开始制作：商家可将订单从 `accepted` 更新为 `cooking`。
12. 商家完成订单：商家可将订单从 `cooking` 更新为 `finished`。
13. 用户端订单状态同步：商家修改订单状态后，用户订单列表和详情页刷新后可看到最新状态。

---

## 二、当前已完成云函数清单

1. `login`：获取用户 openid，创建或更新用户登录信息，并返回商家身份信息。
2. `getMenu`：获取指定商家的分类和上架餐品列表。
3. `getDishDetail`：根据 `dish_id` 获取餐品详情、分类、食材和制作步骤。
4. `createOrder`：根据购物车中的 `dish_id` 和 `quantity` 创建订单，后端重新计算金额。
5. `getUserOrders`：查询当前用户自己的订单列表。
6. `getOrderDetail`：查询当前用户自己的单笔订单详情。
7. `getMerchantOrders`：商家员工查询本店订单列表。
8. `updateOrderStatus`：商家员工更新本店订单状态。
9. `getMerchantOrderDetail`：商家员工查询本店单笔订单详情。

---

## 三、需要部署的云函数清单

以下云函数都需要在微信开发者工具中部署。

部署方式：

```text
右键云函数目录 -> 创建并部署：云端安装依赖
```

需要部署：

1. `cloudfunctions/login`
2. `cloudfunctions/getMenu`
3. `cloudfunctions/getDishDetail`
4. `cloudfunctions/createOrder`
5. `cloudfunctions/getUserOrders`
6. `cloudfunctions/getOrderDetail`
7. `cloudfunctions/getMerchantOrders`
8. `cloudfunctions/updateOrderStatus`
9. `cloudfunctions/getMerchantOrderDetail`

部署后建议逐个在调试器中调用确认，避免出现 `FUNCTION_NOT_FOUND`。

---

## 四、数据库集合清单

MVP 必需集合：

1. `merchants`
   - 用途：保存商家基础信息。
   - 关键字段：`merchant_id`、`name`、`status`。

2. `merchant_staff`
   - 用途：保存商家员工权限。
   - 关键字段：`merchant_id`、`openid`、`role`、`status`。

3. `categories`
   - 用途：保存菜单分类。
   - 关键字段：`category_id`、`merchant_id`、`name`、`status`、`sort_order`。

4. `dishes`
   - 用途：保存餐品数据。
   - 关键字段：`dish_id`、`merchant_id`、`category_id`、`name`、`price_cent`、`status`。

5. `orders`
   - 用途：保存订单主信息。
   - 关键字段：`order_id`、`order_no`、`merchant_id`、`openid`、`status`、`total_amount_cent`。

6. `order_items`
   - 用途：保存订单餐品快照。
   - 关键字段：`order_id`、`dish_id`、`dish_name`、`unit_price_cent`、`quantity`、`subtotal_cent`。

7. `users`
   - 用途：保存用户登录记录。
   - 关键字段：`openid`、`role`、`status`、`last_login_at`。

可选但当前云函数可兼容为空：

1. `dish_ingredients`
2. `ingredients`
3. `production_steps`

---

## 五、最小测试数据清单

1. `merchants` 至少 1 条：

```json
{
  "merchant_id": "merchant_001",
  "name": "测试点餐店",
  "status": "active",
  "business_status": "open"
}
```

2. `merchant_staff` 至少 1 条：

```json
{
  "merchant_id": "merchant_001",
  "openid": "当前测试账号的 openid",
  "role": "owner",
  "status": "active"
}
```

3. `categories` 至少 1 条：

```json
{
  "category_id": "category_001",
  "merchant_id": "merchant_001",
  "name": "招牌推荐",
  "status": "active",
  "sort_order": 1
}
```

4. `dishes` 至少 2 条：

```json
{
  "dish_id": "dish_001",
  "merchant_id": "merchant_001",
  "category_id": "category_001",
  "name": "招牌肥牛石锅拌饭",
  "description": "肥牛现炒，锅巴焦香，拌匀更好吃",
  "image_url": "",
  "price_cent": 2990,
  "tags": ["招牌", "人气TOP1"],
  "status": "on_sale",
  "sort_order": 1
}
```

```json
{
  "dish_id": "dish_002",
  "merchant_id": "merchant_001",
  "category_id": "category_001",
  "name": "经典肉酱砂锅米线",
  "description": "浓香肉酱配爽滑米线，暖胃又满足",
  "image_url": "",
  "price_cent": 2590,
  "tags": ["新品"],
  "status": "on_sale",
  "sort_order": 2
}
```

5. 用户下单后会自动生成：

```text
orders
order_items
```

---

## 六、完整 MVP 测试流程

### 用户端测试

1. 打开微信开发者工具。
2. 编译进入首页 `pages/common/launch/launch`。
3. 点击“立即点餐”或“堂食点餐”，进入菜单页。
4. 检查菜单页是否显示真实分类和餐品。
5. 点击某个餐品，进入餐品详情页。
6. 在餐品详情页点击“加入购物车”。
7. 返回菜单页或进入购物车页。
8. 在购物车页确认商品、数量和金额。
9. 点击“去提交订单”。
10. 下单成功后点击“查看订单”。
11. 在用户订单列表页查看刚创建的订单。
12. 点击订单卡片进入用户订单详情页。
13. 检查订单号、状态、商品明细和金额是否正确。

### 商家端测试

1. 确认当前测试 openid 已加入 `merchant_staff`，并且 `status` 为 `active`。
2. 从首页点击“商家工作台”。
3. 点击“进入商家订单”。
4. 检查商家订单列表是否显示用户刚下的订单。
5. 点击订单卡片进入商家订单详情页。
6. 当订单状态为 `pending` 时，点击“接单”。
7. 状态变为 `accepted` 后，点击“开始制作”。
8. 状态变为 `cooking` 后，点击“完成订单”。
9. 状态变为 `finished` 后，确认不再显示操作按钮。

### 同步验证

1. 商家修改订单状态后，回到用户订单列表页。
2. 用户订单列表页刷新后应显示最新状态。
3. 用户订单详情页重新进入或返回页面后应显示最新状态。
4. 控制台不应出现红色报错。

---

## 七、常见错误与排查

### 1. 云函数 `FUNCTION_NOT_FOUND`

原因：

```text
云函数未部署，或函数名称写错。
```

处理：

1. 在微信开发者工具左侧找到对应云函数目录。
2. 右键选择“创建并部署：云端安装依赖”。
3. 确认调用名称与目录名一致。

### 2. `FORBIDDEN` 商家权限错误

原因：

```text
当前测试账号 openid 没有配置到 merchant_staff，或 status 不是 active。
```

处理：

1. 先调用 `login` 获取当前 openid。
2. 在 `merchant_staff` 添加当前 openid。
3. 确认字段：

```json
{
  "merchant_id": "merchant_001",
  "openid": "当前测试账号 openid",
  "status": "active"
}
```

### 3. 订单列表为空

可能原因：

1. 当前用户还没有下单。
2. 当前 openid 与创建订单时的 openid 不一致。
3. 查询的 `merchant_id` 不是 `merchant_001`。
4. 云函数未部署或返回错误。

处理：

1. 重新从购物车创建一笔订单。
2. 检查 `orders` 集合中是否有新订单。
3. 检查订单中的 `openid` 和当前登录 openid 是否一致。

### 4. 菜单为空

可能原因：

1. `merchants` 中没有 `merchant_001`。
2. 商家 `status` 不是 `active`。
3. `categories` 没有 `active` 分类。
4. `dishes` 没有 `on_sale` 餐品。
5. 餐品 `category_id` 与分类不匹配。

### 5. 商品图片为空

当前页面有本地 fallback 视觉兜底。

建议：

1. 后续在 `dishes.image_url` 中补真实图片地址或本地资源路径。
2. 不要使用容易失效的远程图片链接作为核心展示图。

### 6. `project.private.config.json` 自动修改

原因：

```text
微信开发者工具会自动修改本地私有配置。
```

处理：

1. 一般不要提交该文件。
2. 如果只剩这个文件被修改，可以执行：

```powershell
git restore project.private.config.json
```

### 7. 本地购物车缓存异常

可能原因：

1. 本地缓存中有旧数据。
2. 餐品已被删除或下架。
3. 本地购物车数据结构异常。

处理：

1. 在微信开发者工具中打开“缓存”或“Storage”面板。
2. 清理 `cart_items`。
3. 重新从菜单页加购测试。

---

## 八、当前 MVP 未包含功能

当前 MVP 暂不包含：

1. 微信支付。
2. 退款。
3. 优惠券。
4. 外卖配送。
5. 打印机。
6. 多门店。
7. `manageCategory` 分类管理。
8. `manageDish` 餐品管理。
9. 食材管理。
10. 制作流程管理。
11. 库存扣减。
12. 订单自动通知。

---

## 九、剩余风险

1. 权限规则还需要进一步强化，例如区分 `owner` 和 `staff` 的操作范围。
2. 数据库索引可能需要补充，例如 `orders.merchant_id + status + created_at`。
3. 订单并发和库存还未处理，当前不会自动扣库存。
4. 商家端体验还需要继续完善，例如新订单提醒、下拉刷新、分页加载。
5. 页面真机适配还需要测试，尤其是不同 iPhone 尺寸和 Android 机型。
6. 当前商品图片以 fallback 为主，正式上线前需要补真实素材。
7. 当前未接支付，订单支付状态默认仍是 MVP 预留逻辑。

---

## 十、下一阶段建议

建议优先级：

1. MVP 全链路真机测试。
   - 用真实手机预览。
   - 测试用户下单、商家接单、用户看状态。

2. `manageCategory`。
   - 商家新增、编辑、启用、停用分类。

3. `manageDish`。
   - 商家新增、编辑、上架、下架、售罄餐品。

4. 食材管理。
   - 维护食材基础信息。
   - 为后续食材汇总做准备。

5. 制作流程管理。
   - 维护餐品制作步骤。
   - 用于标准化后厨流程。

6. 支付能力。
   - 在 MVP 稳定后再接入微信支付。
   - 支付必须放在云函数或服务端完成。

---

## 十一、阶段性结论

当前 MVP 已经具备最小点餐闭环：

```text
用户浏览菜单
-> 加入购物车
-> 提交订单
-> 用户查看订单
-> 商家查看订单
-> 商家接单
-> 商家开始制作
-> 商家完成订单
-> 用户查看状态变化
```

下一步不建议立刻扩展复杂功能，建议先完成真机测试和数据稳定性检查，再进入分类和餐品管理。
