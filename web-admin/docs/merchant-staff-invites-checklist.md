# Web 商户成员与邀请码阶段验收清单

适用阶段：`Private-Kitchen-v0.5-D：Web 商户成员与邀请码真实接入`

本文用于记录 Web 商户成员与邀请码阶段的完成范围、权限边界、写入边界、部署要求、本地检查结果和手动预览清单。本阶段只做收尾检查与文档沉淀，不新增业务功能。

## 1. 阶段范围

本阶段已完成能力：

1. Web 成员列表真实读取。
2. Web 邀请码列表真实读取。
3. Web 创建邀请码。
4. Web 禁用邀请码。
5. Web 禁用成员。
6. Web 启用成员。

本阶段未包含能力：

1. 删除成员。
2. 修改成员角色。
3. 删除邀请码。
4. 重新启用邀请码。
5. 批量成员操作。
6. 批量邀请码操作。
7. 独立账号体系。
8. 复杂权限分级。

## 2. 提交清单

| 阶段 | 提交 | 内容 |
| --- | --- | --- |
| D1 | `5b75344b6cda337ce4c8ea514f67a57e52c8b64e` | Web 成员列表真实读取 |
| D2 | `57f513092a4bc5f1d696fe232c7d8e3595f7d806` | Web 邀请码列表真实读取 |
| D3 | `1cf6f937c5f55d309453b74919e8aad74ef0c4ae` | Web 创建邀请码 |
| D4 | `a181d2288ee072f00e78c50aeac13afeb5e7e8e2` | Web 禁用邀请码 |
| D5-1 | `45e597c2e883bbc302a18aa38632a2efc2c31c66` | Web 禁用成员 |
| D5-2 | `6cefb4c67a6eafb7217a196e4d4eb12f5da739da` | Web 启用成员 |

## 3. 后端云函数能力

涉及云函数：`manageMerchantStaff`

已支持 action：

1. `listStaff`
2. `listInvites`
3. `createInvite`
4. `disableInvite`
5. `disableStaff`
6. `enableStaff`

HTTP 网关兼容：

1. 直接 event。
2. `body` JSON 字符串。
3. `body` 对象。
4. `queryStringParameters`。

Web 鉴权：

1. Web 请求使用 `admin_token`。
2. `manageMerchantStaff` 使用 `WEB_ADMIN_TOKEN_SECRET` 校验 token。
3. token 角色必须为 `super_admin`。
4. 校验 token 是否过期。
5. 校验 token 签名是否有效。

小程序端原鉴权保留：

1. 从云函数上下文读取 `OPENID`。
2. 使用 `SUPER_ADMIN_OPENIDS` 判断超级管理员权限。

## 4. Web 页面能力

页面：`web-admin/src/views/MerchantStaffView.vue`

服务封装：`web-admin/src/services/merchant-staff.ts`

页面已支持：

1. 成员列表 loading / error / retry / empty。
2. 邀请码列表 loading / error / retry / empty。
3. 创建邀请码。
4. 复制新邀请码。
5. 禁用邀请码。
6. 禁用成员。
7. 启用成员。
8. 操作成功后刷新对应真实列表。
9. 操作失败显示友好提示。
10. 保持 Direction A 暖色玻璃风格。

## 5. 权限边界

1. Web 端必须携带有效 `admin_token`。
2. `admin_token` 的 role 必须为 `super_admin`。
3. 云函数内部校验权限，不能只依赖前端路由守卫。
4. 小程序端原有 `OPENID + SUPER_ADMIN_OPENIDS` 权限逻辑保留。
5. Web 本阶段不做普通管理员 / 商户成员分级权限。

## 6. 写入边界

1. `createInvite` 只写入 `merchant_invites`。
2. `disableInvite` 只更新 `merchant_invites.status` 和 `merchant_invites.updated_at`。
3. `disableStaff` 只更新成员记录的 `status` 和 `updated_at`。
4. `enableStaff` 只更新成员记录的 `status` 和 `updated_at`。
5. 不删除成员。
6. 不删除邀请码。
7. 不修改成员角色。
8. 不修改订单、餐品、商户基础信息。
9. 不新增数据库集合。

## 7. HTTP 网关配置

需要已有 HTTP 网关：

```text
/manageMerchantStaff -> manageMerchantStaff
```

配置建议：

1. 资源类型：云函数。
2. 资源对象：`manageMerchantStaff`。
3. 身份认证：关闭。

真实权限由云函数内部处理，HTTP 网关只负责把 Web 请求转发到云函数。

## 8. 云函数环境变量

`manageMerchantStaff` 需要：

```text
WEB_ADMIN_TOKEN_SECRET=与 webAdminAuth 完全一致
SUPER_ADMIN_OPENIDS=o0yVU3e7ileUg8eI78-qhrfXGno8
```

Web `.env.local` 继续使用：

```text
VITE_WEB_ADMIN_API_BASE_URL=CloudBase HTTP 网关基础地址
```

注意：

1. `.env.local` 不提交 Git。
2. `WEB_ADMIN_TOKEN_SECRET` 不写入文档明文。
3. `WEB_ADMIN_TOKEN_SECRET` 需要在 CloudBase 云函数环境变量中配置。

## 9. 本地测试清单

本次 D6 收尾检查已执行以下命令：

| 命令 | 结果 |
| --- | --- |
| `node --check cloudfunctions/manageMerchantStaff/index.js` | 通过 |
| `node --check cloudfunctions/manageMerchantStaff/merchant-staff-service.js` | 通过 |
| `node --check cloudfunctions/manageMerchantStaff/manageMerchantStaff.test.js` | 通过 |
| `node --check cloudfunctions/manageMerchantStaff/web-admin-token-helper.js` | 通过 |
| `node cloudfunctions/manageMerchantStaff/manageMerchantStaff.test.js` | 通过，`71/71` |
| `node cloudfunctions/webAdminAuth/webAdminAuth.test.js` | 通过，`25/25` |
| `node cloudfunctions/getAdminOverview/getAdminOverview.test.js` | 通过，`22/22` |
| `node cloudfunctions/manageMerchant/manageMerchant.test.js` | 通过，`41/41` |
| `cd web-admin && npm run build` | 通过 |

提交前还需要确认：

```powershell
git status
git diff --check
```

## 10. 云端部署与预览清单

手动预览需要确认：

1. 重新部署 `manageMerchantStaff`。
2. `WEB_ADMIN_TOKEN_SECRET` 与 `webAdminAuth` 完全一致。
3. HTTP 网关 `/manageMerchantStaff` 正常。
4. 登录 Web 后台。
5. 进入商户成员 / 邀请页。
6. 成员列表显示真实数据。
7. 邀请码列表显示真实数据。
8. 创建邀请码成功后列表刷新，新邀请码可复制。
9. 禁用邀请码成功后列表刷新。
10. 禁用成员成功后成员列表刷新。
11. 启用成员成功后成员列表刷新。
12. 没有删除成员入口。
13. 没有修改成员角色入口。
14. 没有删除邀请码入口。
15. 没有重新启用邀请码入口。

## 11. 已知限制

1. Web 后台当前仍使用后台管理口令 + session token。
2. 暂无独立账号体系。
3. 暂无普通管理员 / 商户成员分级权限。
4. 暂不支持删除成员。
5. 暂不支持修改成员角色。
6. 暂不支持删除邀请码。
7. 暂不支持重新启用邀请码。
8. 暂不支持批量操作。

## 12. 下一阶段建议

建议下一阶段：

```text
Private-Kitchen-v0.5-E：Web 餐品与分类管理真实接入
```

建议拆分：

1. E1：Web 分类列表真实读取。
2. E2：Web 餐品列表真实读取。
3. E3：Web 新增 / 编辑分类。
4. E4：Web 新增 / 编辑餐品基础信息。
5. E5：Web 餐品上下架。
6. E6：Web 餐品做法参考 / 食材配置接入。
7. E7：Web 餐品与分类阶段收尾检查。
