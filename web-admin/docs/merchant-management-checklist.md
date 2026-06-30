# Web 商户管理阶段收尾检查

适用阶段：`Private-Kitchen-v0.5-C5`

本文用于记录 Web 商户管理阶段的验收范围、权限边界、云端配置和回归清单。当前阶段只检查并沉淀文档，不新增业务能力。

## 1. 阶段范围

本阶段覆盖 Web 后台商户管理的真实数据接入：

- 商户列表真实读取。
- 新增商户。
- 编辑商户基础信息。
- 启用 / 禁用商户。
- Web 管理 token 权限校验。
- CloudBase HTTP 网关请求体兼容。

本阶段不包含：

- 删除商户。
- 批量导入 / 批量操作。
- 成员与邀请码真实接入。
- 餐品、订单、今日备料、数据检查等其它页面真实接入。
- 小程序端业务逻辑改造。

## 2. 已完成提交清单

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| v0.5-C1 | `8d0136eb7579840e8c1f8328639353f1778ff0d6` | 接入 Web 商户列表 |
| v0.5-C2 | `370572c5d89b6ba6663661087cde572ba54b7984` | 接入 Web 商户新增 |
| v0.5-C3 | `2eb9c7946c70753effa84903319540cf75fbdfec` | 接入 Web 商户编辑 |
| v0.5-C4 | `db5ca1fbe1bdfc597fbdf3400e749b0f81cc4af3` | 接入 Web 商户启停 |

## 3. 后端云函数能力清单

云函数：`manageMerchant`

支持 action：

- `list`
- `get`
- `create`
- `update`
- `enable`
- `disable`

Web 端当前开放 action：

- `list`
- `create`
- `update`
- `enable`
- `disable`

未开放危险能力：

- 没有 `delete` action。
- 没有批量删除。
- 没有清空集合。
- 没有级联修改订单、餐品、成员或备料数据。

HTTP 网关兼容：

- 直接云函数事件。
- `body` 为 JSON 字符串。
- `body` 为对象。
- `queryStringParameters`。
- 顶层 `merchant_id`。

## 4. Web 页面能力清单

页面：`/merchants`

已接入能力：

- 登录后读取真实商户列表。
- 搜索商户名称 / `merchant_id`。
- 按全部 / 启用 / 禁用筛选。
- 展示商户总数、启用商户、禁用商户、待完善资料。
- 新增商户。
- 编辑商户基础信息。
- 启用商户。
- 禁用商户。
- 操作成功后刷新真实列表。
- 操作失败时显示友好错误。

仍为后续版本能力：

- 成员 / 邀请入口仍进入现有成员页面，成员真实接入不属于本阶段。
- 删除商户未提供入口。
- 批量操作未提供入口。

## 5. 权限边界检查

Web 后台权限：

- Web 请求必须携带 `admin_token`。
- `admin_token` 由 `webAdminAuth` 生成。
- `manageMerchant` 使用 `WEB_ADMIN_TOKEN_SECRET` 校验 token 签名。
- token 过期、篡改、为空、格式错误、角色不是 `super_admin` 时拒绝访问。

小程序后台权限：

- 保留原 `OPENID + SUPER_ADMIN_OPENIDS` 超级管理员校验。
- 未删除或绕过小程序端原权限逻辑。

权限配置要求：

- `webAdminAuth`、`getAdminOverview`、`manageMerchant` 的 `WEB_ADMIN_TOKEN_SECRET` 必须完全一致。
- `SUPER_ADMIN_OPENIDS` 继续用于小程序内系统后台超级管理员判断。
- 不在 Web 前端写死 openid、管理口令或 token secret。

## 6. 数据写入边界检查

`create` 写入范围：

- 创建 `merchants` 文档。
- 写入商户基础字段。
- 默认 `status` 为启用状态。
- 写入 `created_at`、`updated_at`。
- 不允许前端覆盖系统字段。

`update` 写入范围：

- 仅允许更新商户基础信息：
  - 商户名称。
  - 短名称。
  - 负责人 openid。
  - 备注 / 公告。
  - `updated_at`。
- 不允许修改：
  - `merchant_id`
  - `status`
  - `created_at`
  - `members_count`
  - `_id`

`enable` / `disable` 写入范围：

- 仅更新：
  - `status`
  - `updated_at`
- 不写入其它商户字段。
- 不修改成员、订单、餐品、备料数据。

未开放写入：

- 不删除商户。
- 不删除订单。
- 不删除餐品。
- 不清空集合。
- 不修改订单金额或订单状态。

## 7. HTTP 网关配置清单

建议 CloudBase HTTP 网关路径：

- `/webAdminAuth` -> `webAdminAuth`
- `/getAdminOverview` -> `getAdminOverview`
- `/manageMerchant` -> `manageMerchant`

网关配置检查：

- 已开启对应云函数的 HTTP 访问。
- 路径名称与 Web 环境变量一致。
- 网关鉴权策略不阻断 Web 请求。
- CORS 允许本地预览地址，例如：
  - `http://127.0.0.1:5173`
  - `http://127.0.0.1:5174`
  - `http://127.0.0.1:5175`
- 正式部署后补充正式 Web 域名。

Web 环境变量示例：

```text
VITE_WEB_ADMIN_AUTH_ENDPOINT=https://example.com/webAdminAuth
VITE_WEB_ADMIN_API_BASE_URL=https://example.com
```

不要提交 `.env.local`。

## 8. 云函数环境变量清单

`webAdminAuth`：

- `WEB_ADMIN_PASSCODE_HASH`
- `WEB_ADMIN_TOKEN_SECRET`
- `WEB_ADMIN_TOKEN_TTL_MINUTES`

`getAdminOverview`：

- `WEB_ADMIN_TOKEN_SECRET`
- `SUPER_ADMIN_OPENIDS`

`manageMerchant`：

- `WEB_ADMIN_TOKEN_SECRET`
- `SUPER_ADMIN_OPENIDS`

注意：

- `WEB_ADMIN_TOKEN_SECRET` 必须在所有 Web 后台相关云函数中保持一致。
- `WEB_ADMIN_PASSCODE` 只能作为开发 fallback 使用，正式环境建议使用 `WEB_ADMIN_PASSCODE_HASH`。
- 不要把真实环境变量写入前端源码或文档提交。

## 9. 本地预览测试清单

启动 Web 后台：

```powershell
cd web-admin
npm run dev
```

本地检查：

- 打开 `/login`。
- 使用管理口令登录。
- 登录成功后进入首页。
- 进入 `/merchants`。
- 商户列表加载成功。
- 搜索商户名称或 `merchant_id` 正常。
- 全部 / 启用 / 禁用筛选正常。
- 新增商户成功后列表刷新。
- 编辑商户基础信息成功后列表刷新。
- 禁用启用商户前出现确认弹窗。
- 禁用成功后状态变为禁用。
- 启用成功后状态变为启用。
- 操作失败时显示错误提示。
- 页面没有删除商户按钮。
- 点击退出后清除会话并回到登录页。

## 10. 云端联调测试清单

云函数部署：

- 重新部署 `webAdminAuth`。
- 重新部署 `getAdminOverview`。
- 重新部署 `manageMerchant`。

云端检查：

- `webAdminAuth` 能正确登录并返回 token。
- Dashboard 能加载真实总览。
- `/merchants` 能加载真实商户列表。
- Web 新增商户成功。
- Web 编辑商户成功。
- Web 禁用商户成功。
- Web 启用商户成功。
- 普通或无效 token 无法访问 `manageMerchant`。
- 小程序系统后台仍能通过 `OPENID + SUPER_ADMIN_OPENIDS` 权限访问。
- 小程序用户端点餐、下单、订单功能不受影响。

自动检查命令：

```powershell
node --check cloudfunctions/manageMerchant/index.js
node --check cloudfunctions/manageMerchant/merchant-service.js
node --check cloudfunctions/manageMerchant/manageMerchant.test.js
node --check cloudfunctions/manageMerchant/web-admin-token-helper.js
node cloudfunctions/manageMerchant/manageMerchant.test.js

node --check cloudfunctions/getAdminOverview/index.js
node --check cloudfunctions/getAdminOverview/admin-overview-service.js
node --check cloudfunctions/getAdminOverview/getAdminOverview.test.js
node --check cloudfunctions/getAdminOverview/web-admin-token-helper.js
node cloudfunctions/getAdminOverview/getAdminOverview.test.js

node --check cloudfunctions/webAdminAuth/index.js
node --check cloudfunctions/webAdminAuth/web-admin-auth-service.js
node --check cloudfunctions/webAdminAuth/webAdminAuth.test.js
node cloudfunctions/webAdminAuth/webAdminAuth.test.js

cd web-admin
npm run build
cd ..

git status
git diff --check
```

## 11. 已知限制

- Web 商户管理暂不支持删除商户。
- Web 商户管理暂不支持批量操作。
- 成员与邀请码页面仍未接真实数据。
- 餐品、分类、订单、今日备料、数据检查页面仍未全部接真实数据。
- 当前启用 / 禁用只有确认弹窗，暂未接入操作日志展示。
- Web 后台正式部署域名、生产 CORS、上线包策略仍需后续确认。

## 12. 下一阶段建议

建议下一步进入：

```text
Private-Kitchen-v0.5-D：Web 商户成员与邀请码真实接入
```

建议拆分：

- Web 成员列表真实读取。
- Web 邀请码列表真实读取。
- Web 创建邀请码。
- Web 禁用邀请码。
- Web 成员启用 / 禁用。
- 成员与商户权限边界回归。

继续保持原则：

- 每次只接一个页面或一个 action。
- 每个写操作都必须有后端测试。
- 不开放删除类危险操作。
- 不影响小程序端现有闭环。
