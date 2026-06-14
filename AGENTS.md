\# AGENTS.md



\# 微信点餐小程序 Codex 项目总控规则



版本：V1.0

项目名称：微信点餐小程序

技术方案：微信原生小程序 + 腾讯 CloudBase 云开发

协作方式：ChatGPT + Codex

当前阶段：MVP 开发阶段

文档日期：2026-06-06



---



\## 1. 项目说明



本项目是一个微信点餐小程序，目标是实现一个可持续迭代的餐饮点单系统。



系统包含两个核心端：



1\. 用户端：顾客浏览餐品、加入购物车、提交订单、查看订单状态。

2\. 商家端：商家维护餐品、管理订单、处理订单状态、查看食材汇总、维护商品制作流程。



当前阶段是 MVP 阶段，优先实现最小可用业务闭环：



用户浏览菜单 → 加入购物车 → 提交订单 → 商家接收订单 → 商家修改订单状态 → 用户查看订单进度。



---



\## 2. Codex 必须先阅读的文档



在开始任何代码修改前，必须先阅读以下文档：



```text

ai-docs/01\_产品需求文档\_PRD.md

ai-docs/02\_数据库设计.md

ai-docs/03\_云函数设计.md

ai-docs/04\_页面结构与路由设计.md

ai-docs/07\_低保真原型设计.md

ai-docs/08\_UI视觉规范\_商业餐饮风.md

AGENTS.md

```



如果后续新增了其他文档，也必须优先阅读，例如：



```text

ai-docs/06\_开发任务拆解.md

ai-docs/07\_测试清单.md

ai-docs/08\_迭代记录.md

```



---



\## 3. 当前项目目标



当前项目不追求一次性完成复杂商业系统，而是分阶段完成。



\### 3.1 MVP 阶段必须完成



用户端：



1\. 用户登录。

2\. 浏览餐品分类。

3\. 浏览餐品列表。

4\. 查看餐品详情。

5\. 加入购物车。

6\. 提交订单。

7\. 查看订单列表。

8\. 查看订单详情。

9\. 查看订单状态。



商家端：



1\. 商家进入管理端。

2\. 商家查看订单列表。

3\. 商家查看订单详情。

4\. 商家接单。

5\. 商家修改订单为制作中。

6\. 商家完成订单。

7\. 商家维护餐品。

8\. 商家维护分类。



数据库：



1\. 用户集合。

2\. 商家集合。

3\. 商家员工集合。

4\. 分类集合。

5\. 餐品集合。

6\. 订单集合。

7\. 订单明细集合。



云函数：



1\. login。

2\. getMenu。

3\. getDishDetail。

4\. createOrder。

5\. getUserOrders。

6\. getOrderDetail。

7\. getMerchantOrders。

8\. updateOrderStatus。

9\. manageDish。

10\. manageCategory。



---



\## 4. 当前阶段暂不开发的功能



MVP 阶段暂不开发以下功能，除非用户明确要求：



1\. 微信支付。

2\. 退款。

3\. 优惠券。

4\. 会员积分。

5\. 多门店。

6\. 多商户入驻。

7\. 外卖配送。

8\. 骑手端。

9\. 打印机。

10\. 后厨大屏。

11\. 复杂数据看板。

12\. 财务结算。

13\. 发票。

14\. 复杂营销活动。



不要主动把这些功能加入 MVP 代码中。



---



\## 5. 技术栈要求



本项目使用以下技术方案：



```text

微信原生小程序

JavaScript

腾讯 CloudBase 云开发

CloudBase 云数据库

CloudBase 云函数

微信开发者工具

```



当前阶段不允许私自切换为：



```text

uni-app

Taro

React

Vue

Next.js

Node Express 服务端

MySQL

MongoDB 自建服务

Supabase

Firebase

Docker

Kubernetes

```



除非用户明确要求重新规划技术栈。



---



\## 6. 推荐项目目录



项目目录应尽量保持如下结构：



```text

ordering-miniprogram/

├── AGENTS.md

├── README.md

├── project.config.json

│

├── ai-docs/

│   ├── 01\_产品需求文档\_PRD.md

│   ├── 02\_数据库设计.md

│   ├── 03\_云函数设计.md

│   └── 04\_页面结构与路由设计.md

│

├── miniprogram/

│   ├── app.js

│   ├── app.json

│   ├── app.wxss

│   │

│   ├── pages/

│   │   ├── common/

│   │   ├── user/

│   │   └── merchant/

│   │

│   ├── components/

│   ├── utils/

│   └── images/

│

└── cloudfunctions/

&nbsp;   ├── login/

&nbsp;   ├── getMenu/

&nbsp;   ├── getDishDetail/

&nbsp;   ├── createOrder/

&nbsp;   ├── getUserOrders/

&nbsp;   ├── getOrderDetail/

&nbsp;   ├── getMerchantOrders/

&nbsp;   ├── updateOrderStatus/

&nbsp;   ├── manageDish/

&nbsp;   └── manageCategory/

```



不要随意创建与该结构冲突的新目录。



---



\## 7. 页面路径规则



页面路径必须遵守 `ai-docs/04\_页面结构与路由设计.md`。



用户端页面统一放在：



```text

miniprogram/pages/user/

```



商家端页面统一放在：



```text

miniprogram/pages/merchant/

```



通用页面统一放在：



```text

miniprogram/pages/common/

```



通用组件统一放在：



```text

miniprogram/components/

```



通用工具函数统一放在：



```text

miniprogram/utils/

```



---



\## 8. 数据库集合规则



必须严格按照 `ai-docs/02\_数据库设计.md` 使用数据库集合。



MVP 阶段核心集合包括：



```text

users

merchants

merchant\_staff

categories

dishes

orders

order\_items

```



第二阶段集合包括：



```text

ingredients

dish\_ingredients

production\_steps

operation\_logs

notifications

```



可选集合包括：



```text

carts

system\_settings

```



未经用户确认，不要新增文档中未定义的集合。



---



\## 9. 字段命名规则



数据库字段统一使用小写字母加下划线。



正确示例：



```text

merchant\_id

user\_openid

created\_at

updated\_at

price\_cent

total\_amount\_cent

```



禁止混用以下风格：



```text

merchantId

userOpenid

createdAt

totalAmount

```



---



\## 10. 金额规则



所有金额必须使用“分”为单位。



数据库字段必须使用：



```text

price\_cent

total\_amount\_cent

subtotal\_cent

```



示例：



```text

2800 = 28.00 元

```



前端页面展示时再转换为：



```text

¥28.00

```



禁止在数据库中使用浮点金额，例如：



```text

28.8

18.5

```



订单金额必须由云函数重新计算，不能相信前端传入金额。



---



\## 11. 时间字段规则



所有集合默认使用：



```text

created\_at

updated\_at

```



订单相关时间字段包括：



```text

accepted\_at

cooking\_at

finished\_at

cancelled\_at

paid\_at

```



时间字段应尽量由云函数写入，不要完全相信前端时间。



---



\## 12. 订单状态规则



订单状态只能使用以下值：



```text

pending

accepted

cooking

finished

cancelled

```



对应含义：



```text

pending：待接单

accepted：已接单

cooking：制作中

finished：已完成

cancelled：已取消

```



允许的状态流转：



```text

pending -> accepted

pending -> cancelled

accepted -> cooking

accepted -> cancelled

cooking -> finished

```



禁止的状态流转：



```text

pending -> cooking

pending -> finished

accepted -> finished

cooking -> accepted

finished -> 任何状态

cancelled -> 任何状态

```



所有订单状态修改必须通过云函数完成。



---



\## 13. 餐品状态规则



餐品状态只能使用以下值：



```text

on\_sale

off\_sale

sold\_out

```



对应含义：



```text

on\_sale：上架中

off\_sale：已下架

sold\_out：已售罄

```



用户端菜单只展示：



```text

on\_sale

```



---



\## 14. 支付状态规则



MVP 阶段暂不接入微信支付。



支付状态字段可以预留：



```text

unpaid

paid

refunded

closed

```



MVP 阶段默认：



```text

payment\_status = unpaid

payment\_method = offline

```



不要在 MVP 阶段主动开发支付逻辑。



---



\## 15. 云函数规则



所有云函数必须遵守 `ai-docs/03\_云函数设计.md`。



MVP 阶段云函数包括：



```text

login

getMenu

getDishDetail

createOrder

getUserOrders

getOrderDetail

getMerchantOrders

updateOrderStatus

manageDish

manageCategory

```



后续阶段云函数包括：



```text

getIngredientSummary

manageIngredient

manageProductionSteps

```



所有云函数必须使用统一返回格式。



成功格式：



```json

{

&nbsp; "success": true,

&nbsp; "code": "SUCCESS",

&nbsp; "message": "操作成功",

&nbsp; "data": {}

}

```



失败格式：



```json

{

&nbsp; "success": false,

&nbsp; "code": "ERROR\_CODE",

&nbsp; "message": "错误说明",

&nbsp; "data": null

}

```



分页格式：



```json

{

&nbsp; "success": true,

&nbsp; "code": "SUCCESS",

&nbsp; "message": "查询成功",

&nbsp; "data": {

&nbsp;   "list": \[],

&nbsp;   "pagination": {

&nbsp;     "page": 1,

&nbsp;     "page\_size": 20,

&nbsp;     "has\_more": true

&nbsp;   }

&nbsp; }

}

```



---



\## 16. 权限规则



\### 16.1 openid 获取规则



云函数必须从微信云函数上下文获取 openid。



正确方式：



```js

const wxContext = cloud.getWXContext()

const openid = wxContext.OPENID

```



禁止直接相信前端传入的 openid。



---



\### 16.2 用户权限



普通用户可以：



1\. 查看已上架餐品。

2\. 创建自己的订单。

3\. 查看自己的订单。

4\. 查看自己的订单详情。



普通用户禁止：



1\. 查看其他用户订单。

2\. 修改订单状态。

3\. 修改餐品。

4\. 修改分类。

5\. 进入商家管理接口成功。



---



\### 16.3 商家权限



商家身份必须通过 `merchant\_staff` 集合校验。



校验条件：



```js

{

&nbsp; merchant\_id,

&nbsp; openid,

&nbsp; status: 'active'

}

```



商家用户可以：



1\. 查看自己商家的订单。

2\. 修改自己商家的订单状态。

3\. 管理自己商家的餐品。

4\. 管理自己商家的分类。

5\. 管理自己商家的食材。

6\. 管理自己商家的制作流程。



商家用户禁止：



1\. 查看其他商家的订单。

2\. 修改其他商家的订单。

3\. 修改其他商家的餐品。

4\. 修改其他商家的分类。

5\. 直接删除历史订单。



---



\## 17. 前端开发规则



\### 17.0 页面与组件原型、视觉规则



开发任何页面和组件前，必须先阅读并遵守：



```text

ai-docs/07\_低保真原型设计.md

ai-docs/08\_UI视觉规范\_商业餐饮风.md

```



页面结构必须优先遵守 `ai-docs/07\_低保真原型设计.md`。

页面视觉必须优先遵守 `ai-docs/08\_UI视觉规范\_商业餐饮风.md`。



本项目当前 UI 风格已确定为“商业餐饮风 / 韩式快餐小程序风 / 明亮品牌点餐风”。



后续页面和组件开发必须体现：



1\. 浅灰背景。

2\. 白色卡片。

3\. 品牌红主按钮。

4\. 食物大图。

5\. 中等圆角。

6\. 轻阴影。

7\. 成熟餐饮品牌小程序感觉。

8\. 左侧分类 + 右侧商品卡片的点餐页结构。

9\. 明显的底部购物车结算条。

10\. 清晰的订单状态标签。



页面样式应尽量通过 `app.wxss`、公共 class、组件样式和统一变量控制，避免每个页面单独写一套完全不同的视觉风格。



---



\### 17.1 页面不得直接操作核心数据库



页面不要直接操作：



```text

orders

order\_items

dishes

categories

merchant\_staff

merchants

ingredients

dish\_ingredients

production\_steps

```



页面必须通过云函数完成关键操作。



---



\### 17.2 云函数调用封装



前端应统一通过：



```text

miniprogram/utils/cloud.js

```



调用云函数。



不要在每个页面中重复写大量 `wx.cloud.callFunction` 逻辑。



---



\### 17.3 购物车规则



MVP 阶段购物车使用本地缓存。



购物车工具函数放在：



```text

miniprogram/utils/cart.js

```



购物车缓存 key：



```text

cart\_items

```



购物车规则：



1\. 同一餐品重复加入时，只增加数量。

2\. 数量不能小于 1。

3\. 数量为 0 时从购物车移除。

4\. 购物车只允许同一商家的餐品。

5\. 提交订单成功后清空购物车。

6\. 下单时必须由云函数重新校验价格、库存和餐品状态。



---



\### 17.4 金额格式化



金额展示必须使用：



```text

miniprogram/utils/format.js

```



不要在页面中到处手写金额格式化逻辑。



---



\### 17.5 状态文案



订单状态、餐品状态、支付状态必须统一映射。



建议放在：



```text

miniprogram/utils/constants.js

```



不要在多个页面重复硬编码状态文案。



---



\## 18. 组件规则



通用组件放在：



```text

miniprogram/components/

```



推荐组件包括：



```text

dish-card

order-card

status-tag

empty-state

loading-view

```



组件应保持简单，不要在组件中直接调用云函数，除非任务明确要求。



组件主要负责展示和触发事件，业务逻辑由页面处理。



---



\## 19. 商家端页面规则



商家端页面路径统一在：



```text

miniprogram/pages/merchant/

```



商家端页面必须进行前端基础身份判断。



如果当前用户不是商家员工，页面应提示：



```text

你没有商家管理权限

```



然后跳转回：



```text

pages/user/menu/menu

```



但注意：前端判断只能作为体验优化，真实权限必须在云函数中校验。



---



\## 20. Codex 修改代码规则



每次修改代码时，必须遵守以下规则：



1\. 每次只完成一个明确任务。

2\. 不要一次性大范围重构。

3\. 不要删除已有功能。

4\. 不要随意改变项目技术栈。

5\. 不要随意新增数据库集合。

6\. 不要随意新增订单状态。

7\. 不要随意新增餐品状态。

8\. 不要绕过云函数直接操作核心数据库。

9\. 不要把敏感密钥写入前端。

10\. 不要把支付逻辑写到前端。

11\. 修改前先理解相关文档。

12\. 修改后必须说明改了哪些文件。

13\. 修改后必须说明如何测试。

14\. 遇到不确定的业务规则，不要自行发挥，应保守处理并说明疑问。

15\. 涉及页面和组件时，不允许只实现功能而忽略 UI 规范。

16\. 页面完成后，必须说明该页面如何符合 `ai-docs/07\_低保真原型设计.md` 和 `ai-docs/08\_UI视觉规范\_商业餐饮风.md`。



---



\## 21. 禁止事项



Codex 禁止做以下事情：



1\. 禁止未经确认重写整个项目。

2\. 禁止未经确认切换框架。

3\. 禁止未经确认引入大型第三方库。

4\. 禁止把普通用户和商家端逻辑混在一个页面。

5\. 禁止前端直接创建订单主数据。

6\. 禁止前端直接修改订单状态。

7\. 禁止前端传入 openid 后直接当作可信身份。

8\. 禁止使用浮点数保存金额。

9\. 禁止删除历史订单。

10\. 禁止随意清空数据库。

11\. 禁止在代码中写入真实密钥。

12\. 禁止在 MVP 阶段主动加入微信支付。

13\. 禁止在没有测试说明的情况下完成任务。

14\. 禁止修改 ai-docs 文档，除非任务明确要求更新文档。

15\. 禁止使用系统默认蓝色按钮。

16\. 禁止使用普通模板页面样式。

17\. 禁止忽略商业餐饮风。

18\. 禁止在页面中随意使用与 UI 规范不一致的颜色。

19\. 禁止每个页面单独写一套完全不同的视觉风格。

20\. 禁止直接复制参考图中的品牌、图片、文字、图标和素材。



---



\## 22. 推荐开发顺序



Codex 应按以下顺序开发项目。



\### 22.1 第一阶段：项目初始化



目标：



1\. 创建微信小程序基础目录。

2\. 创建 `miniprogram` 目录。

3\. 创建 `cloudfunctions` 目录。

4\. 创建基础工具函数目录。

5\. 创建基础页面目录。

6\. 配置 `app.json` 页面路径。

7\. 不实现复杂业务，只保证项目能打开。



---



\### 22.2 第二阶段：基础云函数



优先开发：



```text

login

getMenu

getDishDetail

```



目标：



1\. 用户可以登录。

2\. 用户可以获取菜单。

3\. 用户可以查看餐品详情。



---



\### 22.3 第三阶段：用户端菜单和购物车



开发页面：



```text

pages/common/launch/launch

pages/user/menu/menu

pages/user/dish-detail/dish-detail

pages/user/cart/cart

```



目标：



1\. 用户能打开小程序。

2\. 用户能看到餐品。

3\. 用户能加入购物车。

4\. 用户能查看购物车。



---



\### 22.4 第四阶段：用户下单闭环



开发云函数：



```text

createOrder

getUserOrders

getOrderDetail

```



开发页面：



```text

pages/user/submit-order/submit-order

pages/user/order-list/order-list

pages/user/order-detail/order-detail

```



目标：



1\. 用户能提交订单。

2\. 用户能查看订单列表。

3\. 用户能查看订单详情。



---



\### 22.5 第五阶段：商家接单闭环



开发云函数：



```text

getMerchantOrders

updateOrderStatus

```



开发页面：



```text

pages/merchant/dashboard/dashboard

pages/merchant/orders/orders

pages/merchant/order-detail/order-detail

```



目标：



1\. 商家能进入管理端。

2\. 商家能查看订单。

3\. 商家能接单。

4\. 商家能修改订单状态。

5\. 用户端能看到订单状态变化。



---



\### 22.6 第六阶段：商家餐品和分类管理



开发云函数：



```text

manageDish

manageCategory

```



开发页面：



```text

pages/merchant/dishes/dishes

pages/merchant/dish-edit/dish-edit

pages/merchant/categories/categories

```



目标：



1\. 商家能新增分类。

2\. 商家能编辑分类。

3\. 商家能新增餐品。

4\. 商家能编辑餐品。

5\. 商家能上架、下架、售罄餐品。



---



\### 22.7 第七阶段：食材和制作流程



后续开发：



```text

manageIngredient

getIngredientSummary

manageProductionSteps

```



开发页面：



```text

pages/merchant/ingredients/ingredients

pages/merchant/ingredient-summary/ingredient-summary

pages/merchant/production-steps/production-steps

```



目标：



1\. 商家能维护食材。

2\. 商家能查看食材汇总。

3\. 商家能维护制作流程。



---



\## 23. 每次任务开始前的要求



Codex 在开始执行任务前，需要先明确：



1\. 本次任务目标是什么。

2\. 需要修改哪些文件。

3\. 可能新增哪些文件。

4\. 涉及哪些云函数。

5\. 涉及哪些数据库集合。

6\. 涉及哪些页面。

7\. 是否会影响已有功能。

8\. 是否需要用户手动配置。



如果任务涉及页面或组件开发，必须先确认：



1\. 当前页面对应 `ai-docs/07\_低保真原型设计.md` 中的哪个页面。

2\. 当前页面应该有哪些模块。

3\. 当前页面应该遵守 `ai-docs/08\_UI视觉规范\_商业餐饮风.md` 中的哪些视觉规则。

4\. 是否需要使用统一组件和公共样式。

5\. 是否避免了系统默认蓝色按钮和普通模板页面样式。



如果任务描述不清晰，优先根据现有文档做保守实现，不要扩大范围。



---



\## 24. 每次任务完成后的回复格式



Codex 完成任务后，必须按照以下格式汇报：



```text

本次完成内容：

1\. ...

2\. ...



新增文件：

1\. ...



修改文件：

1\. ...



涉及云函数：

1\. ...



涉及页面：

1\. ...



如何测试：

1\. ...

2\. ...

3\. ...



需要你手动配置的地方：

1\. ...



注意事项：

1\. ...

```



如果任务没有完全完成，必须明确说明：



```text

未完成内容：

1\. ...



原因：

1\. ...



建议下一步：

1\. ...

```



---



\## 25. 报错修复规则



当用户提供报错时，Codex 应按以下顺序处理：



1\. 先阅读报错信息。

2\. 判断报错来自前端、云函数、数据库权限还是配置。

3\. 找到最小修改范围。

4\. 只修复当前报错。

5\. 不做无关重构。

6\. 修复后说明原因和测试方法。



禁止看到一个报错后顺手大改项目结构。



---



\## 26. 数据库变更规则



任何数据库字段、集合、状态值的变更，都必须先更新：



```text

ai-docs/02\_数据库设计.md

```



未经用户确认，不要直接修改数据库设计。



如果代码实现中发现文档缺失字段，应先说明：



```text

发现当前功能需要新增字段：xxx

建议更新数据库设计文档后再继续实现

```



不要偷偷新增字段。



---



\## 27. 云函数变更规则



任何云函数入参、出参、错误码、权限规则的变更，都必须先更新：



```text

ai-docs/03\_云函数设计.md

```



未经用户确认，不要改变云函数接口格式。



---



\## 28. 页面变更规则



任何新增页面、删除页面、修改页面路径的行为，都必须先更新：



```text

ai-docs/04\_页面结构与路由设计.md

```



未经用户确认，不要随意改变页面路径。



---



\## 29. 测试规则



每完成一个功能，必须提供测试步骤。



测试步骤应适合小白用户执行，不能只写：



```text

运行测试即可

```



应具体说明：



```text

1\. 打开微信开发者工具。

2\. 进入用户菜单页。

3\. 点击某个餐品的加号。

4\. 打开购物车页。

5\. 检查商品数量和金额是否正确。

```



---



\## 30. 小白友好规则



本项目使用者是编程小白。



Codex 回复时应尽量：



1\. 少用复杂术语。

2\. 必须解释需要用户手动操作的步骤。

3\. 不要默认用户知道命令行。

4\. 不要省略关键操作。

5\. 需要用户复制命令时，必须给出完整命令。

6\. 需要用户在微信开发者工具中操作时，必须说明按钮位置或操作路径。

7\. 不要用一句“配置环境变量”结束，应说明具体配置什么。



---



\## 31. Git 版本管理建议



每完成一个小功能，建议用户提交一次 Git。



提交信息建议格式：



```text

feat: 完成用户菜单页

feat: 完成购物车页面

feat: 完成创建订单云函数

fix: 修复订单金额计算问题

docs: 更新数据库设计文档

```



Codex 不应自动执行危险的 Git 操作，例如：



```text

git reset --hard

git clean -fd

force push

```



除非用户明确要求并理解风险。



---



\## 32. 环境与密钥规则



不要把以下内容写入前端代码：



1\. 微信支付商户密钥。

2\. API 密钥。

3\. 私钥。

4\. 数据库管理员密钥。

5\. 第三方服务密钥。



如需配置环境变量或云函数环境变量，必须告诉用户在哪里配置、配置什么、为什么配置。



---



\## 33. 微信支付规则



MVP 阶段不接微信支付。



后续接入支付时必须遵守：



1\. 支付下单必须在云函数或服务端完成。

2\. 支付密钥不能放在前端。

3\. 支付回调必须在服务端处理。

4\. 订单金额必须以后端计算为准。

5\. 支付成功后再修改支付状态。

6\. 支付失败不能误改订单为已支付。



在用户明确要求前，不要主动开发支付功能。



---



\## 34. CloudBase 规则



CloudBase 相关开发必须注意：



1\. 云函数需要初始化 cloud。

2\. 数据库操作放在云函数中。

3\. 前端通过 `wx.cloud.callFunction` 调用云函数。

4\. 开发前需要用户在微信开发者工具中开通云开发环境。

5\. 数据库集合需要用户在云开发控制台中创建，或由初始化脚本创建。

6\. 云函数开发完成后需要上传并部署。



如果需要用户手动操作，必须明确说明。



---



\## 35. 默认商家规则



MVP 阶段默认使用一个测试商家：



```text

merchant\_001

```



默认商家 ID 可以放在：



```text

miniprogram/utils/constants.js

```



示例：



```js

const DEFAULT\_MERCHANT\_ID = 'merchant\_001'

```



后续多商家版本再改为动态商家 ID。



---



\## 36. 购物车 MVP 规则



MVP 阶段购物车使用本地缓存，不使用数据库集合。



原因：



1\. 降低开发复杂度。

2\. 减少数据库读写。

3\. 更适合第一版快速跑通。



后续如果需要跨设备同步购物车，再启用 `carts` 集合。



---



\## 37. 订单创建安全规则



创建订单时，前端只能传：



```text

merchant\_id

items

remark

pickup\_type

contact\_phone

```



其中 `items` 只能包含：



```text

dish\_id

quantity

```



云函数必须重新查询 `dishes` 集合，并重新生成：



```text

dish\_name

dish\_image

price\_cent

subtotal\_cent

total\_amount\_cent

item\_count

```



禁止相信前端传来的商品名称、商品价格、订单总价。



---



\## 38. 订单明细快照规则



`order\_items` 必须保存下单时的商品快照。



必须保存：



```text

dish\_id

dish\_name

dish\_image

price\_cent

quantity

subtotal\_cent

```



原因：



商家后续修改餐品名称、图片、价格时，历史订单不能被影响。



---



\## 39. 操作日志规则



MVP 第一阶段可以不强制完成操作日志页面，但关键云函数建议写入：



```text

operation\_logs

```



建议记录：



1\. 创建订单。

2\. 接单。

3\. 开始制作。

4\. 完成订单。

5\. 取消订单。

6\. 新增餐品。

7\. 编辑餐品。

8\. 上架餐品。

9\. 下架餐品。

10\. 修改分类。



如果当前阶段为了简化没有写入日志，需要在完成说明中注明。



---



\## 40. 新订单提醒规则



MVP 阶段新订单提醒优先采用：



1\. 商家端订单页定时刷新。

2\. 新订单高亮显示。

3\. 可选播放提示音。



暂不强制开发：



1\. 微信订阅消息。

2\. WebSocket。

3\. 打印机。

4\. 企业微信机器人。



---



\## 41. 代码风格规则



代码应尽量保持：



1\. 简洁。

2\. 易读。

3\. 小白可理解。

4\. 函数命名清晰。

5\. 注释适量。

6\. 不写过度复杂的抽象。

7\. 不引入没必要的设计模式。



优先可维护，而不是炫技。



---



\## 42. 依赖规则



不要随意添加第三方依赖。



如必须添加依赖，必须说明：



1\. 依赖名称。

2\. 用途。

3\. 为什么必须使用。

4\. 是否会增加项目复杂度。

5\. 如何安装。

6\. 如何删除。



MVP 阶段尽量少依赖。



---



\## 43. 初始化任务建议



如果用户要求“开始开发”，Codex 应优先执行以下初始化任务：



1\. 检查当前项目目录结构。

2\. 确认是否已有微信小程序项目文件。

3\. 确认是否已有 `miniprogram` 目录。

4\. 确认是否已有 `cloudfunctions` 目录。

5\. 确认是否已有 `app.js`、`app.json`、`app.wxss`。

6\. 确认是否已有 `project.config.json`。

7\. 不要直接覆盖已有项目。

8\. 如果目录为空，再创建基础结构。



---



\## 44. 第一次让 Codex 读取项目时的推荐回复



当用户第一次让 Codex 读取项目时，Codex 应先总结：



```text

我已阅读项目文档，当前理解如下：



项目目标：

...



技术栈：

...



MVP 核心功能：

...



数据库集合：

...



云函数：

...



页面结构：

...



建议第一步开发任务：

...

```



不要第一次就直接开始写大量代码。



---



\## 45. 当前结论



本项目是一个小白友好的微信点餐小程序开发项目。



Codex 的核心任务不是自由发挥，而是严格按照文档完成：



1\. 小步开发。

2\. 小步测试。

3\. 小步提交。

4\. 按文档维护数据库。

5\. 按文档维护云函数。

6\. 按文档维护页面。

7\. 先完成 MVP。

8\. 再逐步迭代高级功能。



任何时候，如果功能实现和文档冲突，应优先遵守文档，并向用户说明冲突点。



