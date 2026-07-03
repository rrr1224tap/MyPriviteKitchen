# Web 餐品与分类阶段验收清单

适用阶段：`Private-Kitchen-v0.5-E：Web 餐品与分类管理真实接入`

本文用于记录 Web 餐品与分类阶段的完成范围、权限边界、写入边界、部署要求、本地检查结果和手动预览清单。本阶段只做收尾检查与文档沉淀，不新增业务功能。

## 1. 阶段范围

本阶段已完成能力：

1. Web 分类列表真实读取。
2. Web 餐品列表真实读取。
3. Web 新增分类。
4. Web 编辑分类。
5. Web 新增餐品基础信息。
6. Web 编辑餐品基础信息。
7. Web 餐品上架 / 下架。
8. Web 餐品做法参考 `tutorials` 编辑。
9. Web 餐品食材配置 `ingredients` 编辑。
10. Web 餐品右侧选中详情面板。

本阶段未包含能力：

1. 删除分类。
2. 分类排序。
3. 删除餐品。
4. 餐品排序。
5. 餐品规格 `specs` / 加料 `addons` 的 Web 编辑。
6. 餐品库存、售罄和复杂选项配置的 Web 编辑。
7. 支付、优惠券、会员、营销等非本阶段能力。
8. 小程序端页面改造。

## 2. 提交清单

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| E1 | `9c40f238f6a701d8b55689a9af329a665f050b23` | Web 分类列表真实读取 |
| E2 | `4806e66930a478a7a7e8c35d81d3895556d86113` | Web 餐品列表真实读取 |
| E3 | `5984cf2cfbdef7b237d1a005e2ea94c627cf41be` | Web 新增 / 编辑分类 |
| E4-1 | `2c97d7b63ca84dde4ad63b6886a37fab69876dbf` | Web 新增餐品基础信息 |
| E4-2 | `e568e9290a3dc5907998838d4a3e250ca6edb9d4` | Web 编辑餐品基础信息 |
| E5 | `e9b0b97b3384d30dc14c6bba2070983f77a44fe7` | Web 餐品上下架 |
| E6-1 | `ef2fc1f8115c1f66c2cfa78827a5536e577230cb` | Web 餐品做法参考编辑 |
| E6-2 | `1cfcd6429b3f5e463884b2385d1c8b7253d450d4` | Web 餐品食材配置编辑 |

## 3. 后端云函数能力

涉及云函数：

1. `manageCategory`
2. `manageDish`

`manageCategory` Web 端已开放 action：

1. `listCategories`
2. `createCategory`
3. `updateCategory`

`manageDish` Web 端已开放 action：

1. `listDishes`
2. `createDish`
3. `updateDish`
4. `updateDishStatus`
5. `updateDishTutorials`
6. `updateDishIngredients`

HTTP 网关兼容：

1. 直接 event。
2. `body` JSON 字符串。
3. `body` 对象。
4. `queryStringParameters`。

小程序端原鉴权保留：

1. 从云函数上下文读取 `OPENID`。
2. 使用 `merchant_staff` 校验当前用户是否为对应商户的 active 成员。
3. 不依赖前端传入 openid。

## 4. Web 页面能力

分类页面：`web-admin/src/views/CategoriesView.vue`

服务封装：`web-admin/src/services/categories.ts`

页面已支持：

1. 分类列表 loading / error / retry / empty。
2. 读取真实分类列表。
3. 新增分类。
4. 编辑分类。
5. 新增 / 编辑成功后刷新真实分类列表。
6. 删除和排序仅提示后续接入，不执行真实写入。

餐品页面：`web-admin/src/views/DishesView.vue`

服务封装：`web-admin/src/services/dishes.ts`

页面已支持：

1. 餐品列表 loading / error / retry / empty。
2. 读取真实餐品列表。
3. 新增餐品基础信息。
4. 编辑餐品基础信息。
5. 上架 / 下架餐品。
6. 编辑做法参考 `tutorials`。
7. 编辑食材配置 `ingredients`。
8. 写入成功后刷新真实餐品列表。
9. 右侧展示选中餐品详情。
10. 点击餐品行切换右侧详情。
11. 列表刷新后优先保持原选中餐品，若不存在则选中第一条。
12. 删除、排序、规格和加料仅提示后续接入，不执行真实写入。

## 5. 权限边界

1. Web 请求必须携带有效 `admin_token`。
2. `admin_token` 由 `webAdminAuth` 生成。
3. `manageCategory` 和 `manageDish` 使用 `WEB_ADMIN_TOKEN_SECRET` 校验 token。
4. token 角色必须为 `super_admin`。
5. token 为空、篡改、过期或角色不符时拒绝访问。
6. 小程序端继续使用 `OPENID + merchant_staff active` 权限逻辑。
7. Web 页面不直接操作核心数据库。
8. Web 服务层统一通过 `callAdminFunction` 调用 CloudBase HTTP 网关。

## 6. 写入边界

分类写入边界：

1. `createCategory` 只创建 `categories` 记录。
2. `updateCategory` 只更新分类基础字段和 `updated_at`。
3. 不删除分类。
4. 不执行分类排序。
5. 不修改其它商户的分类。

餐品写入边界：

1. `createDish` 只创建餐品基础信息。
2. `updateDish` 只更新餐品基础信息。
3. `updateDishStatus` 只更新 `dishes.status` 和 `dishes.updated_at`。
4. `updateDishTutorials` 只更新 `dishes.tutorials` 和 `dishes.updated_at`。
5. `updateDishIngredients` 只更新 `dishes.ingredients` 和 `dishes.updated_at`。
6. 不删除餐品。
7. 不执行餐品排序。
8. 不通过 Web 写入 `specs` / `addons`。
9. 不修改订单、成员、邀请码、商户基础信息。
10. 不新增数据库集合。

## 7. 数据字段

分类核心字段：

1. `merchant_id`
2. `category_id`
3. `name`
4. `sort_order`
5. `status`
6. `created_at`
7. `updated_at`

餐品核心字段：

1. `dish_id`
2. `merchant_id`
3. `category_id`
4. `name`
5. `description`
6. `image_url`
7. `price_cent`
8. `status`
9. `sort_order`
10. `tutorials`
11. `ingredients`
12. `created_at`
13. `updated_at`

`tutorials` 单项字段：

1. `title`
2. `platform`
3. `url`
4. `note`
5. `enabled`
6. `sort_order`

`ingredients` 单项字段：

1. `name`
2. `amount`
3. `unit`
4. `category`
5. `note`
6. `enabled`
7. `sort_order`

## 8. HTTP 网关配置

需要已有 HTTP 网关：

```text
/manageCategory -> manageCategory
/manageDish -> manageDish
```

配置建议：

1. 资源类型：云函数。
2. 资源对象：对应云函数。
3. 身份认证：关闭。

真实权限由云函数内部处理，HTTP 网关只负责把 Web 请求转发到云函数。

## 9. 云函数环境变量

`manageCategory` 需要：

```text
WEB_ADMIN_TOKEN_SECRET=与 webAdminAuth 完全一致
```

`manageDish` 需要：

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
3. `WEB_ADMIN_TOKEN_SECRET` 需要在 Web 后台相关云函数中保持一致。

## 10. 本地测试清单

本次 E7 收尾检查已执行以下命令：

| 命令 | 结果 |
| --- | --- |
| `node --check cloudfunctions/manageCategory/index.js` | 通过 |
| `node --check cloudfunctions/manageCategory/category-service.js` | 通过 |
| `node --check cloudfunctions/manageCategory/manageCategory.test.js` | 通过 |
| `node --check cloudfunctions/manageCategory/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/manageCategory/manageCategory.test.js` | 通过，`39/39` |
| `node --check cloudfunctions/manageDish/index.js` | 通过 |
| `node --check cloudfunctions/manageDish/dish-service.js` | 通过 |
| `node --check cloudfunctions/manageDish/manageDish.test.js` | 通过 |
| `node --check cloudfunctions/manageDish/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/manageDish/manageDish.test.js` | 通过，`127/127` |
| `cd web-admin && npm run build` | 通过 |

提交前还需要确认：

```powershell
git status
git diff --check
```

## 11. 云端部署与预览清单

手动预览需要确认：

1. 重新部署 `manageCategory`。
2. 重新部署 `manageDish`。
3. 两个云函数的 `WEB_ADMIN_TOKEN_SECRET` 与 `webAdminAuth` 完全一致。
4. HTTP 网关 `/manageCategory` 正常。
5. HTTP 网关 `/manageDish` 正常。
6. 登录 Web 后台。
7. 进入分类管理页，分类列表显示真实数据。
8. 新增分类成功后列表刷新。
9. 编辑分类成功后列表刷新。
10. 删除分类和排序不执行真实写入。
11. 进入餐品管理页，餐品列表显示真实数据。
12. 新增餐品成功后列表刷新。
13. 编辑餐品成功后列表刷新。
14. 上架 / 下架成功后列表刷新。
15. 做法参考保存和清空后列表刷新。
16. 食材配置保存和清空后列表刷新。
17. 点击餐品行可切换右侧选中详情。
18. 删除餐品、排序、规格和加料不执行真实写入。
19. 商户管理、成员邀请和 Dashboard 页面不受影响。

## 12. 已知限制

1. Web 分类暂不支持删除。
2. Web 分类暂不支持排序。
3. Web 餐品暂不支持删除。
4. Web 餐品暂不支持排序。
5. Web 餐品暂不支持规格 `specs` / 加料 `addons` 编辑。
6. Web 餐品暂不支持库存和售罄编辑。
7. Web 后台当前仍使用后台管理口令 + session token。
8. 暂无普通管理员 / 商户成员分级权限。

## 13. 下一阶段建议

建议下一步进入：

```text
Private-Kitchen-v0.5-F：Web 订单管理真实接入
```

可选后续能力：

1. Web 订单列表真实读取。
2. Web 订单详情真实读取。
3. Web 订单状态流转。
4. Web 今日备料真实读取。
5. 餐品规格 / 加料编辑。
6. 分类和餐品排序。
7. 分类和餐品删除策略评审。

继续保持原则：

1. 每次只接一个页面或一个 action。
2. 每个写操作都必须有后端测试。
3. 不开放未经确认的删除类危险操作。
4. 不影响小程序端现有点餐闭环。
