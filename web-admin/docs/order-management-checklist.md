# Web 订单管理阶段验收清单

适用阶段：`Private-Kitchen-v0.5-F：Web 订单管理真实接入`

本文用于记录 Web 订单管理阶段的完成范围、权限边界、写入边界、测试结果和手动预览结果。本阶段只做收尾检查与文档沉淀，不新增业务功能。

## 1. 阶段目标

本阶段目标是让 Web 后台订单管理从占位页升级为真实订单管理能力：

1. 读取当前商户真实订单列表。
2. 支持订单列表分页、状态筛选和刷新。
3. 读取当前商户真实订单详情。
4. 展示订单商品明细。
5. 只读展示规格 / 加料快照。
6. 支持正常订单状态流转。
7. 状态流转成功后刷新订单列表和当前订单详情。

本阶段不包含取消、删除、退款、支付、打印机或后厨出单能力。

## 2. 提交清单

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| F1 | `1348d9b0e10510bab5dbe811d64f73004686306b` | Web 订单列表真实读取 |
| F2 | `83a9e9a3c66b1fab098df179edae0539cee909c7` | Web 订单详情真实读取 |
| F3 | `1e972738360901908004c09e9baa216e63dca334` | Web 订单状态流转 |

## 3. 已完成能力

订单管理页已完成：

1. 订单列表真实读取。
2. 分页。
3. 状态筛选。
4. 刷新订单列表。
5. 订单详情真实读取。
6. 订单商品明细展示。
7. 规格 / 加料快照只读展示。
8. 订单状态流转。
9. 状态流转后刷新订单列表。
10. 状态流转后刷新当前订单详情。

## 4. 当前未开放能力

本阶段明确未开放：

1. 取消订单。
2. 删除订单。
3. 退款。
4. 微信支付。
5. 打印机 / 后厨出单。
6. 备料汇总 Web 接入。
7. 订单金额修改。
8. 商品明细修改。
9. 联系人信息修改。
10. 小程序代码改造。

退款、微信支付、打印机 / 后厨出单可作为远期能力保留，但当前不实现、不提供真实入口、不新增接口。

## 5. 云函数范围

本阶段涉及云函数：

1. `getMerchantOrders`
2. `getMerchantOrderDetail`
3. `updateOrderStatus`

`getMerchantOrders` Web action：

1. `listOrders`

`getMerchantOrderDetail` Web action：

1. `getOrderDetail`

`updateOrderStatus` Web action：

1. `updateOrderStatus`

HTTP 网关兼容：

1. 直接 event。
2. `body` JSON 字符串。
3. `body` 对象。
4. `queryStringParameters`。
5. 无效 JSON body 不崩溃。

## 6. Web 前端范围

服务层：

1. `web-admin/src/services/orders.ts`

页面：

1. `web-admin/src/views/OrdersView.vue`

样式：

1. `web-admin/src/styles/global.css`

前端调用约束：

1. 订单列表请求走 `orders.ts` 的 `listOrders`。
2. 订单详情请求走 `orders.ts` 的 `getOrderDetail`。
3. 订单状态更新请求走 `orders.ts` 的 `updateOrderStatus`。
4. 页面中不散写 `fetch` 调用云函数。
5. 不引入 `axios`。
6. 不引入 CloudBase Web SDK。
7. `admin_token` 由现有 `callAdminFunction` 统一携带。

## 7. 鉴权说明

Web 鉴权：

1. Web 请求必须携带有效 `admin_token`。
2. `admin_token` 由 `webAdminAuth` 生成。
3. 订单相关云函数使用 `WEB_ADMIN_TOKEN_SECRET` 校验 token。
4. token 签名必须有效。
5. token 未过期。
6. token role 必须为 `super_admin`。
7. token 为空、篡改、过期或 role 不符时拒绝访问。

小程序 / 商家端原有权限逻辑保留：

1. 从云函数上下文读取 `OPENID`。
2. 使用 `merchant_staff` 校验当前用户是否为对应商户的 active 成员。
3. 不依赖前端传入 openid。
4. 不允许跨商户读取或更新订单。

## 8. 当前订单状态

当前订单状态值：

1. `pending`：待接单
2. `accepted`：已接单
3. `cooking`：制作中
4. `finished`：已完成
5. `cancelled`：已取消

当前 Web 允许状态流转：

```text
pending -> accepted
accepted -> cooking
cooking -> finished
```

Web 端不开放流转到 `cancelled`。

## 9. 写入边界

订单列表：

1. 只读。
2. 不执行订单写入。

订单详情：

1. 只读。
2. 商品明细只读。
3. 规格 / 加料快照只读。

订单状态流转：

1. Web 端仅更新 `orders.status`。
2. Web 端仅更新 `orders.updated_at`。
3. 不修改订单金额。
4. 不修改商品明细。
5. 不修改联系人信息。
6. 不修改备注。
7. 不删除订单。
8. 不退款。
9. 不新增数据库集合。

说明：小程序 / 商家端原有 `updateOrderStatus` 仍保留自身既有状态时间字段逻辑；Web 本阶段按边界仅更新 `status / updated_at`。

## 10. 当前列表字段

订单列表当前展示：

1. 订单号。
2. 下单时间。
3. 联系人 / 手机号 / openid 摘要。
4. 金额。
5. 商品数。
6. 状态。
7. 备注。
8. 查看详情操作。

## 11. 当前详情字段

订单详情当前展示：

1. 订单号。
2. 状态。
3. 下单时间。
4. 更新时间。
5. 金额。
6. 商品数。
7. 联系人。
8. 手机号。
9. openid 摘要。
10. 商品明细。
11. 规格 / 加料快照。
12. 备注。
13. 取餐时间。
14. 用餐方式。
15. 地址等订单中已有字段。

## 12. 本地测试结果

本次 F4 收尾检查已执行：

| 命令 | 结果 |
| --- | --- |
| `node --check cloudfunctions/getMerchantOrders/index.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrders/merchant-orders-service.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrders/getMerchantOrders.test.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrders/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/getMerchantOrders/getMerchantOrders.test.js` | 通过，`19/19` |
| `node --check cloudfunctions/getMerchantOrderDetail/index.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrderDetail/merchant-order-detail-service.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrderDetail/getMerchantOrderDetail.test.js` | 通过 |
| `node --check cloudfunctions/getMerchantOrderDetail/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/getMerchantOrderDetail/getMerchantOrderDetail.test.js` | 通过，`23/23` |
| `node --check cloudfunctions/updateOrderStatus/index.js` | 通过 |
| `node --check cloudfunctions/updateOrderStatus/order-status-service.js` | 通过 |
| `node --check cloudfunctions/updateOrderStatus/updateOrderStatus.test.js` | 通过 |
| `node --check cloudfunctions/updateOrderStatus/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/updateOrderStatus/updateOrderStatus.test.js` | 通过，`43/43` |
| `cd web-admin && npm run build` | 通过 |

提交前还需要确认：

```powershell
git status
git diff --check
```

## 13. 云端部署与预览结果

云端预览已确认：

1. 订单列表真实读取通过。
2. 分页通过。
3. 状态筛选通过。
4. 刷新订单列表通过。
5. 订单详情真实读取通过。
6. 商品明细展示通过。
7. 规格 / 加料快照只读展示通过。
8. 状态流转通过。
9. 状态流转后订单列表刷新通过。
10. 状态流转后当前订单详情刷新通过。
11. 没有取消订单真实操作。
12. 没有删除订单真实操作。
13. 没有退款真实操作。
14. 没有微信支付真实操作。
15. 没有打印机 / 后厨出单真实操作。

## 14. 云端配置要求

需要确认 HTTP 网关：

```text
/getMerchantOrders -> getMerchantOrders
/getMerchantOrderDetail -> getMerchantOrderDetail
/updateOrderStatus -> updateOrderStatus
```

需要确认云函数环境变量：

```text
WEB_ADMIN_TOKEN_SECRET=与 webAdminAuth 完全一致
```

如果云端原函数依赖其它权限变量，应保持原配置，不在本阶段移除。

Web `.env.local` 继续使用：

```text
VITE_WEB_ADMIN_API_BASE_URL=CloudBase HTTP 网关基础地址
```

注意：

1. `.env.local` 不提交 Git。
2. `WEB_ADMIN_TOKEN_SECRET` 不写入前端源码。
3. Web 后台订单相关云函数的 `WEB_ADMIN_TOKEN_SECRET` 需要与 `webAdminAuth` 保持一致。

## 15. 已知限制

1. Web 订单管理暂不支持取消订单。
2. Web 订单管理暂不支持删除订单。
3. Web 订单管理暂不支持退款。
4. Web 订单管理暂不支持微信支付。
5. Web 订单管理暂不支持打印机 / 后厨出单。
6. Web 订单管理暂不支持备料汇总。
7. Web 状态流转只开放正常流程，不开放取消类危险操作。
8. 暂无普通管理员 / 商户成员分级 Web 权限。

## 16. 后续待做

建议下一步进入：

```text
Private-Kitchen-v0.5-G 或正式上线收尾
```

可选后续能力：

1. Web 今日备料真实读取。
2. 订单取消策略单独评审。
3. 删除类能力单独评审。
4. 退款能力随支付阶段单独设计。
5. 微信支付作为后续支付阶段能力。
6. 打印机 / 后厨出单作为远期能力。
7. 订单异常处理和操作日志展示。

继续保持原则：

1. 每次只接一个页面或一个 action。
2. 每个写操作都必须有后端测试。
3. 不开放未经确认的删除、退款、取消类危险操作。
4. 不影响小程序端现有点餐闭环。
