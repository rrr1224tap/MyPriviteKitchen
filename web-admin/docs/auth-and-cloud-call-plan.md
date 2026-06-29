# Web 后台登录与云端调用方案

## 1. 当前现状

Web 后台当前处于 v0.5-A 静态原型阶段：

1. 已有 Vite + Vue 3 + TypeScript 项目。
2. 已有 `/login` 和后台主布局。
3. 登录页现在只做前端跳转，不保存真实登录态。
4. 后台页面全部使用 mock 数据。
5. Web 前端还没有云函数调用封装。
6. Web 前端还没有路由守卫。
7. Web 前端没有接入真实云函数，也没有接入真实数据库。

现有小程序端和后台云函数状态：

1. 小程序端依赖微信云开发上下文获取 `OPENID`。
2. 超级管理员能力当前通过 `SUPER_ADMIN_OPENIDS` 环境变量判断。
3. `getAdminProfile`、`manageMerchant`、`manageMerchantStaff`、`getAdminOverview`、`checkAdminDataHealth` 等系统级云函数都以 `cloud.getWXContext().OPENID` 为身份来源。
4. 商家能力云函数如 `manageDish`、`getPrepSummary` 通过 `merchant_staff` 集合校验商家身份。
5. 这些云函数目前天然适配微信小程序调用，不天然适配普通浏览器 Web 后台。

## 2. Web 端登录难点

Web 后台和微信小程序登录最大的差异是：浏览器里没有微信小程序运行时，也不能直接得到可信 `OPENID`。

主要难点：

1. Web 前端不能直接调用 `wx.cloud`。
2. Web 前端不能从微信小程序上下文获得 `OPENID`。
3. 不能把超级管理员 `openid` 写死在前端。
4. 不能把管理口令明文写在前端。
5. 不能让浏览器直接访问云数据库。
6. 不能绕过云函数权限校验。
7. 现有系统级云函数以 `OPENID + SUPER_ADMIN_OPENIDS` 为授权基础，需要为 Web 增加新的可信身份来源。

## 3. 小程序 openid 与 Web 登录差异

小程序端：

1. 用户从微信进入。
2. 云函数通过 `cloud.getWXContext()` 获取可信 `OPENID`。
3. 云函数再根据 `merchant_staff` 或 `SUPER_ADMIN_OPENIDS` 判断权限。

Web 端：

1. 用户从浏览器进入。
2. 浏览器没有小程序 `OPENID`。
3. 如果直接复用 `SUPER_ADMIN_OPENIDS`，会缺少可信的 openid 来源。
4. 因此 Web 端需要先建立自己的管理会话，再让云函数校验这个会话。

结论：`SUPER_ADMIN_OPENIDS` 可以继续保留给小程序内系统后台使用，但不建议作为 Web 后台第一版登录的唯一方案。

## 4. 推荐方案

推荐第一版采用：

```text
后台管理口令 + Web session token
```

基本流程：

1. 新增 Web 专用登录云函数：`webAdminAuth`。
2. Web 登录页输入管理口令。
3. `webAdminAuth` 校验云函数环境变量中的口令哈希。
4. 校验通过后，返回短期 session token。
5. Web 前端把 token 保存在 `sessionStorage`。
6. Web 前端调用后台云函数时携带 token。
7. 后台云函数校验 token 后再执行操作。
8. 第一版 token 只代表超级管理员能力。
9. 退出登录时清除 `sessionStorage`。
10. token 过期后要求重新登录。

推荐原因：

1. 不依赖微信小程序 `OPENID`。
2. 不需要立刻建设完整账号密码体系。
3. 不需要新增数据库集合。
4. 可以继续复用现有云函数的大部分业务逻辑。
5. 不影响小程序端现有登录、商家工作台、订单、菜单、备料能力。

## 5. 不推荐方案

### 5.1 不推荐把 openid 写死在前端

原因：

1. 前端代码可被查看。
2. openid 一旦写死，任何人都可能伪造管理员身份。
3. 违反当前权限边界。

### 5.2 不推荐把管理口令明文写在前端

原因：

1. 前端代码可被查看。
2. 构建产物里可能暴露敏感信息。
3. 口令必须只存在于云函数环境变量或安全配置中。

### 5.3 不推荐第一版做完整账号密码体系

原因：

1. 需要新增账号集合、密码哈希、找回密码、锁定策略、审计日志等配套能力。
2. 开发成本明显高于当前阶段需求。
3. 容易扩大 v0.5-B 范围。

### 5.4 不推荐 Web 前端直接访问数据库

原因：

1. 会绕过云函数权限校验。
2. 容易误改核心业务数据。
3. 与当前项目“关键操作必须通过云函数”的规则冲突。

## 6. 方案比较

| 方案 | 优点 | 缺点 | 当前项目适配度 | 安全风险 | 开发成本 | 是否推荐 |
| --- | --- | --- | --- | --- | --- | --- |
| 方案 A：后台管理口令 + Web session token | 轻量、独立于微信 openid、不新增账号集合、适合第一版 | 需要新增登录云函数和 token 校验逻辑；需要逐个改造 Web 要接入的云函数 | 高 | 中，需要做好 token 签名、过期和环境变量保护 | 中 | 推荐 |
| 方案 B：继续依赖微信 openid / SUPER_ADMIN_OPENIDS | 可复用现有超级管理员判断；小程序内已验证 | 浏览器没有天然可信 openid；容易走向前端写死 openid；Web 登录体验不完整 | 低 | 高，如果 openid 来源处理不好会失控 | 低到中 | 不推荐作为 Web 第一版 |
| 方案 C：独立账号密码体系 | 标准后台登录模型；后续可扩展多角色 | 需要新增账号集合、密码安全、锁定、审计、重置等能力 | 中 | 中，需要较完整安全设计 | 高 | 后续可考虑，第一版不推荐 |

## 7. 是否新增云函数

建议新增云函数：

```text
webAdminAuth
```

建议支持 action：

1. `login`：校验管理口令，返回 session token。
2. `verify`：校验 token 是否有效，返回当前 Web 管理身份。
3. `logout`：第一版可选；如果 token 是无状态短期 token，前端清除即可。

建议环境变量：

```text
WEB_ADMIN_PASSCODE_HASH
WEB_ADMIN_TOKEN_SECRET
WEB_ADMIN_TOKEN_TTL_MINUTES
```

第一版如果实现简单，可以先使用环境变量中的明文口令，但更推荐保存哈希，不保存明文。

## 8. 是否新增数据库集合

第一版不建议新增数据库集合。

原因：

1. 目标是轻量登录与会话。
2. 可以使用短期签名 token，不需要保存 session 记录。
3. 避免提前引入账号体系。

后续如果需要审计、强制下线、多管理员账号，可以再新增集合，例如：

```text
admin_users
admin_sessions
admin_operation_logs
```

但这些不属于 v0.5-B 第一版范围。

## 9. 是否改造现有云函数

需要改造，但建议分阶段、按接入顺序改造。

现有云函数当前主要通过 `OPENID` 做权限判断。Web 端调用时应新增 token 校验入口，但不能删除原来的小程序 `OPENID` 权限判断。

推荐做法：

1. 保留原有小程序调用路径。
2. 对 Web 端要接入的云函数增加 `admin_token` 校验。
3. token 校验通过后，视为 `super_admin` 身份。
4. 只允许 token 获得系统后台白名单能力，不开放任意数据库操作。
5. 每个云函数仍保留原有参数校验和业务限制。

第一批建议改造：

1. `getAdminOverview`
2. `manageMerchant`
3. `manageMerchantStaff`
4. `checkAdminDataHealth`

后续再改造：

1. `manageDish`
2. `manageCategory`
3. `getMerchantOrders`
4. `getMerchantOrderDetail`
5. `getPrepSummary`

## 10. Web 前端需要新增哪些文件

建议后续新增：

```text
web-admin/src/services/auth.ts
web-admin/src/services/cloud.ts
web-admin/src/services/admin-overview.ts
web-admin/src/stores/session.ts
web-admin/src/types/api.ts
```

文件职责：

1. `auth.ts`：登录、校验登录态、退出登录。
2. `cloud.ts`：统一封装云函数调用。
3. `admin-overview.ts`：封装总览接口调用。
4. `session.ts`：管理 `sessionStorage` 中的 token 和身份信息。
5. `api.ts`：统一成功 / 失败返回结构类型。

如果后续使用 CloudBase Web SDK，还需要根据实际方案增加 SDK 初始化文件，例如：

```text
web-admin/src/services/cloudbase.ts
```

## 11. 后端 / 云函数需要新增哪些文件

建议后续新增：

```text
cloudfunctions/webAdminAuth/index.js
cloudfunctions/webAdminAuth/web-admin-auth-service.js
cloudfunctions/webAdminAuth/webAdminAuth.test.js
cloudfunctions/webAdminAuth/package.json
```

如果需要复用 token 校验逻辑，可以考虑为每个需要接入 Web 的云函数复制或引入一份小型校验 helper。由于 CloudBase 每个云函数独立部署，公共 helper 的打包方式需要在实际开发时确认。

建议 helper 能力：

1. 校验 token 签名。
2. 校验 token 过期时间。
3. 返回 `role: 'super_admin'`。
4. 失败时返回统一 `UNAUTHORIZED` 或 `FORBIDDEN`。

## 12. Web 端如何调用云函数

待确认两种技术路径：

### 12.1 CloudBase Web SDK

思路：

1. Web 前端安装并初始化 CloudBase Web SDK。
2. 使用环境变量配置 CloudBase 环境 ID。
3. Web 前端通过 SDK 调用云函数。
4. 每次调用带上 `admin_token`。

优点：

1. 更贴近 CloudBase 体系。
2. 云函数调用方式较统一。

注意：

1. 会新增 npm 依赖。
2. 需要确认 Web 端匿名登录或自定义登录方式。
3. 不能把 CloudBase 密钥写进前端。

### 12.2 云函数 HTTP 访问

思路：

1. 为 Web 后台需要调用的云函数开启 HTTP 访问。
2. Web 前端通过 `fetch` 调用。
3. 请求头或请求体携带 `admin_token`。

优点：

1. 前端实现简单。
2. 不一定需要新增 SDK 依赖。

注意：

1. 需要配置 HTTP 访问、域名和 CORS。
2. 每个 HTTP 云函数必须严格校验 token。
3. 不能把任何云端管理密钥暴露到浏览器。

建议：

第一版可以先技术验证 CloudBase Web SDK 是否顺畅；如果配置复杂，再评估 HTTP 访问。无论哪种方式，真实权限都必须由云函数里的 token 校验完成。

## 13. 安全边界

必须遵守：

1. 管理口令不写前端。
2. token 密钥不写前端。
3. 超级管理员 openid 不写前端。
4. 前端只保存短期 token。
5. token 过期后必须重新登录。
6. 云函数必须校验 token，不能只相信前端路由守卫。
7. Web 前端不能直接访问数据库。
8. Web 前端不能直接修改订单金额。
9. Web 前端不能直接修改订单状态。
10. 数据检查修复仍必须白名单限制。
11. 小程序端原有 `OPENID` 和 `merchant_staff` 权限逻辑必须保留。

建议 token 规则：

1. 使用服务端密钥签名。
2. 包含过期时间。
3. 包含角色，例如 `super_admin`。
4. 不包含真实敏感信息。
5. 有效期建议 2-8 小时。

## 14. 哪些云函数可以直接复用

业务逻辑可以复用，但 Web 调用前需要补齐 Web 身份校验：

1. `getAdminOverview`
2. `manageMerchant`
3. `manageMerchantStaff`
4. `checkAdminDataHealth`
5. `manageDish`
6. `manageCategory`
7. `getMerchantOrderDetail`
8. `getPrepSummary`

不建议直接复用：

1. `login`：它是小程序微信登录，不适合作为 Web 登录。
2. `getMenu`：它面向用户端菜单，只展示上架餐品，不适合作为后台餐品管理主接口。
3. `getDishDetail`：它面向用户端详情，后台编辑需要更多字段。

必须等登录方案确认后再接：

1. 所有写操作云函数。
2. 数据检查修复类云函数。
3. 商户、成员、餐品、分类管理类云函数。

## 15. 推荐 v0.5-B 开发拆分

### v0.5-B1：新增 Web 管理登录云函数

目标：

1. 新增 `webAdminAuth`。
2. 支持 `login` 和 `verify`。
3. 校验管理口令。
4. 返回短期 token。

涉及文件：

1. `cloudfunctions/webAdminAuth/index.js`
2. `cloudfunctions/webAdminAuth/web-admin-auth-service.js`
3. `cloudfunctions/webAdminAuth/webAdminAuth.test.js`
4. `cloudfunctions/webAdminAuth/package.json`

不做事项：

1. 不接总览真实数据。
2. 不做完整账号体系。
3. 不新增数据库集合。

测试方式：

1. 正确口令登录成功。
2. 错误口令登录失败。
3. 空口令登录失败。
4. token 可校验。
5. 过期 token 失败。

验收标准：

1. `webAdminAuth` 测试通过。
2. 口令不在前端。
3. token 由云函数生成。

### v0.5-B2：Web 前端登录页接入

目标：

1. 登录页调用 `webAdminAuth.login`。
2. 成功后保存 token 到 `sessionStorage`。
3. 登录失败显示错误提示。
4. 登录成功跳转 `/`。

涉及文件：

1. `web-admin/src/views/LoginView.vue`
2. `web-admin/src/services/auth.ts`
3. `web-admin/src/stores/session.ts`
4. `web-admin/.env.example`

不做事项：

1. 不接所有后台真实数据。
2. 不新增账号注册。
3. 不保存长期 token。

测试方式：

1. 输入正确口令能进入后台。
2. 输入错误口令不能进入后台。
3. 刷新页面后 sessionStorage 内 token 仍可用于短期会话。

验收标准：

1. 登录页不再是纯静态跳转。
2. 登录错误有友好提示。
3. 前端不包含真实口令。

### v0.5-B3：Web 路由守卫与退出登录

目标：

1. 未登录访问后台跳转 `/login`。
2. 已登录访问 `/login` 可跳转 `/`。
3. 退出登录清除 token。
4. token 失效后要求重新登录。

涉及文件：

1. `web-admin/src/router/index.ts`
2. `web-admin/src/layouts/AdminLayout.vue`
3. `web-admin/src/stores/session.ts`
4. `web-admin/src/services/auth.ts`

不做事项：

1. 不做多角色路由权限。
2. 不开放普通商家 Web 后台。

测试方式：

1. 清空 token 后访问 `/`。
2. 登录后访问每个页面。
3. 点击退出后再次访问后台。

验收标准：

1. 未登录无法看到后台页面。
2. 退出后无法继续访问后台页面。

### v0.5-B4：Web 云函数调用封装

目标：

1. 新增统一云函数调用封装。
2. 每次调用自动携带 token。
3. 统一处理 `SUCCESS`、`UNAUTHORIZED`、`FORBIDDEN`、网络错误。
4. token 失效时跳转登录。

涉及文件：

1. `web-admin/src/services/cloud.ts`
2. `web-admin/src/types/api.ts`
3. `web-admin/src/services/auth.ts`

不做事项：

1. 不在页面里散写云函数调用。
2. 不直接访问数据库。

测试方式：

1. mock 成功响应。
2. mock 未授权响应。
3. mock 网络错误。

验收标准：

1. 页面调用都走统一封装。
2. 未授权处理一致。

### v0.5-B5：接入 getAdminOverview 做真实总览

目标：

1. 将 Dashboard mock 数据替换为 `getAdminOverview` 真实数据。
2. 增加加载态、错误态、刷新按钮。
3. 保留当前 Direction A 视觉风格。

涉及文件：

1. `cloudfunctions/getAdminOverview/index.js`
2. `cloudfunctions/getAdminOverview/admin-overview-service.js`
3. `cloudfunctions/getAdminOverview/getAdminOverview.test.js`
4. `web-admin/src/views/DashboardView.vue`
5. `web-admin/src/services/admin-overview.ts`

不做事项：

1. 不接商户管理写操作。
2. 不接数据修复。
3. 不改订单金额、状态、下单逻辑。

测试方式：

1. token 有效时加载总览数据。
2. token 无效时返回无权限。
3. 刷新按钮可重新加载。
4. 云函数仍只读数据库。

验收标准：

1. 总览数据来自真实云函数。
2. 普通未登录 Web 用户不可访问。
3. 小程序端不受影响。

## 16. 验收标准

v0.5-B0 本方案文档验收：

1. 明确 Web 后台不直接复用小程序 openid 登录。
2. 明确推荐“后台管理口令 + Web session token”。
3. 明确需要新增 `webAdminAuth` 云函数。
4. 明确第一版不新增数据库集合。
5. 明确现有云函数需要按接入顺序增加 Web token 校验。
6. 明确 Web 前端需要新增登录、会话、云函数调用封装。
7. 明确 v0.5-B 后续拆分。

后续 v0.5-B 功能验收：

1. 未登录不能访问后台。
2. 登录成功后可访问后台。
3. 退出后不能继续访问后台。
4. token 过期后要求重新登录。
5. Web 调用云函数必须携带 token。
6. 云函数必须校验 token。
7. 小程序端原有能力不受影响。

## 17. 风险点

1. CloudBase Web SDK 或 HTTP 调用路径需要技术验证。
2. token 签名和过期校验不能写得太随意。
3. 如果多个云函数重复实现 token 校验，后续维护成本会升高。
4. 如果过早做完整账号体系，会拖大 v0.5-B 范围。
5. 如果继续依赖 openid，Web 端会缺少可信身份来源。
6. 如果 token 有效期过长，泄露后的风险会升高。
7. 如果 Web 前端直接保存敏感配置，会破坏安全边界。
8. 如果系统级云函数同时支持小程序 openid 和 Web token，需要测试两条路径都不回归。

