# 囤耗材 小程序架构设计 v1 (Local-First，预留 Cloud)

> 立项日期：2026-08-04
> 目标：MVP 数据**全本地**；后续 V2 数据**全云端**，**业务代码不改**。

---

## 1. 设计原则

| 原则 | 说明 |
|------|------|
| **本地优先 (Local-First)** | 用户写入先落本地、立刻可见，不等网络 |
| **离线可用** | 断网时全部功能（除扫码匹配）正常使用 |
| **端口适配器 (Hexagonal)** | 业务逻辑依赖 Repository **抽象接口**，不依赖 `wx.setStorage` 具体实现 |
| **单向事实源 (Single Source of Truth)** | 每张表一个 Repository，一个主 key |
| **可测试** | Repository 接口可被 mock，单测不用真机 |
| **向后兼容** | MVP schema 字段在 V2 不删改，只新增；本地数据迁移用 `version` 字段区分 |

---

## 2. 分层架构总览

```
┌──────────────────────────────────────────────┐
│          Pages / Components (WXML)           │
│  (s0 首页 · s1 详情 · s4 扫码 · s8 批量 …)   │
└───────────────────┬──────────────────────────┘
                    │ 调用 service
┌───────────────────▼──────────────────────────┐
│              Domain Services                  │
│  ItemService · TemplateService ·             │
│  FamilyService · SyncService · AlertService  │
│                                              │
│  职责：业务规则、状态机、估算计算、聚合运算    │
│  ✗ 不感知数据来自本地还是云端                  │
└───────────────────┬──────────────────────────┘
                    │ repo.xxx()
┌───────────────────▼──────────────────────────┐
│           Repository (抽象接口)               │
│                                              │
│  IItemRepository                             │
│  IInventoryRepository                         │
│  ITemplateRepository                          │
│  IFamilyRepository                            │
│  ISyncLogRepository                           │
│                                              │
│  职责：CRUD + query + transaction             │
│  ✗ 不感知 wx.setStorage / cloud.database      │
└──────┬───────────────────────────┬────────────┘
       │                           │
┌──────▼─────────┐   ┌─────────────▼────────────┐
│ LocalProvider  │   │  CloudProvider (V2 预留) │
│                │   │                          │
│ Object Store   │   │  微信云数据库 / REST API  │
│ (wx.storage)   │   │                          │
└────────────────┘   └──────────────────────────┘
       ▲                           ▲
       │                           │
┌──────┴───────────────────────────┴───────────┐
│          Storage Drivers (适配层)             │
│                                              │
│  WxStorageDriver   |   CloudDbDriver         │
│  (wx.setStorage)   |   (wx.cloud.database)  │
└──────────────────────────────────────────────┘
```

---

## 3. 工程文件结构

```
miniprogram/                          ← 小程序根目录
│
├── app.js                            # 入口：初始化 Repository 工厂
├── app.json                          # 页面注册 + tabBar + 权限
├── app.wxss                          # 全局样式 + 设计 token
├── project.config.json               # 项目配置
├── sitemap.json
│
├── pages/                            # UI 层
│   ├── index/        ← s0 首页
│   ├── detail/       ← s1 商品详情（拖动调整）
│   ├── capture/      ← s2/s3/s4 拍照/语音/扫码
│   ├── manual/       ← s5 手动录入
│   ├── template/     ← s6 模版入口（选人数+选模版）
│   ├── batch/        ← s8 批量调整（12 项竖排）
│   └── my/           ← s7 我的
│
├── services/                         # 业务逻辑层
│   ├── item.service.js               # 商品：录入/改完/标记用完/估算
│   ├── template.service.js           # 模版：加载/导入/渲染
│   ├── family.service.js             # 家庭人数：读写 + 联动刷新
│   ├── alert.service.js              # 提醒：冷启动检测 + 推订阅消息
│   └── sync.service.js               # V2：双向同步 (MVP 仅 NoOp 实现)
│
├── repositories/                     # 数据访问层
│   ├── interfaces/                   # 抽象接口定义
│   │   ├── base.repository.js        # 通用接口
│   │   ├── item.repository.js
│   │   ├── inventory.repository.js
│   │   ├── family.repository.js
│   │   ├── location.repository.js
│   │   ├── template.repository.js
│   │   └── sync-log.repository.js
│   │
│   ├── local/                        # 本地实现（MVP）
│   │   ├── local.item.repository.js
│   │   ├── local.inventory.repository.js
│   │   ├── local.family.repository.js
│   │   ├── local.location.repository.js
│   │   ├── local.template.repository.js
│   │   └── local.sync-log.repository.js
│   │
│   ├── cloud/                        # 云端实现（V2）
│   │   └── *.cloud.repository.js     # 镜像实现，共用同一接口
│   │
│   └── index.js                      # 工厂：根据配置返回 local 或 cloud 实例
│
├── drivers/                          # 存储适配层
│   ├── wx.storage.driver.js          # 封装 wx.setStorage / getStorage / remove
│   ├── file.driver.js                # 封装 wx.getFileSystemManager (读模版 JSON)
│   └── cloud.db.driver.js            # V2：封装 wx.cloud.database
│
├── models/                           # Schema + 校验
│   ├── item.model.js
│   ├── inventory.model.js
│   ├── family-member.model.js
│   ├── storage-location.model.js
│   ├── item-template.model.js
│   ├── template-entry.model.js
│   └── sync-action.model.js
│
├── storage/                          # 预置数据
│   └── templates/
│       ├── baby.json                 # 母婴待产包 32 项
│       ├── pantry.json               # 粮油干货 28 项
│       ├── cleaning.json             # 日用清洁 41 项
│       └── first-aid.json            # 急救药箱 18 项
│
├── utils/
│   ├── storage.js                    # wx.setStorageSync 包装 (带 try/catch + 序列化)
│   ├── id.js                         # 自增 ID 生成器 (local_incr 方案)
│   ├── time.js                       # now() / today() / formatDate()
│   ├── estimate.js                   # 估算法：estEnds / remainDays
│   └── validate.js                   # 模型校验函数
│
└── docs/
    ├── architecture.md               # 本文档
    └── plans/
        └── 2026-07-31-household-consumables-design.md
```

---

## 4. Repository 接口设计

### 4.1 通用接口 (Base)

```js
// repositories/interfaces/base.repository.js
class IBaseRepository {
  async getById(id) { throw new Error('NotImplemented') }
  async list(filter = {}, opts = {}) { throw new Error('NotImplemented') }
  async create(entity) { throw new Error('NotImplemented') }
  async update(id, patch) { throw new Error('NotImplemented') }
  async delete(id) { throw new Error('NotImplemented') }
  async count(filter = {}) { throw new Error('NotImplemented') }
  async transaction(fn) { throw new Error('NotImplemented') }
}
```

### 4.2 ItemRepository (商品主数据)

```js
// repositories/interfaces/item.repository.js
class IItemRepository extends IBaseRepository {
  async findByBarcode(barcode) { throw new Error('NotImplemented') }
  async findByNameFuzzy(keyword) { throw new Error('NotImplemented') }
  async listByCategory(categoryId) { throw new Error('NotImplemented') }
  async findByTplItemKey(key) { throw new Error('NotImplemented') }
}
```

### 4.3 InventoryRepository (库存，业务核心)

```js
// repositories/interfaces/inventory.repository.js
class IInventoryRepository extends IBaseRepository {
  async findActiveByItemId(itemId) { throw new Error('NotImplemented') }
  async listActive(filter = {}) { throw new Error('NotImplemented') }
  async listExpiringWithin(days) { throw new Error('NotImplemented') }
  async adjustQty(id, delta) { throw new Error('NotImplemented') }
  async markFinished(id) { throw new Error('NotImplemented') }
  async updateRemaining(id, newRemaining) { throw new Error('NotImplemented') }
}
```

### 4.4 FamilyRepository (家庭人数快照)

```js
// repositories/interfaces/family.repository.js
class IFamilyRepository extends IBaseRepository {
  async getAll() { throw new Error('NotImplemented') }
  async setCount(role, count) { throw new Error('NotImplemented') }
  async increment(role, delta = 1) { throw new Error('NotImplemented') }
}
```

### 4.5 LocationRepository (存储位置字典)

```js
// repositories/interfaces/location.repository.js
class ILocationRepository extends IBaseRepository {
  async listAll() { throw new Error('NotImplemented') }
  async add(path) { throw new Error('NotImplemented') }
  async remove(id) { throw new Error('NotImplemented') }
  async incrementUseCount(id) { throw new Error('NotImplemented') }
}
```

### 4.6 TemplateRepository (模版只读)

```js
// repositories/interfaces/template.repository.js
class ITemplateRepository {
  async list() { throw new Error('NotImplemented') }
  async getByKey(tplKey) { throw new Error('NotImplemented') }
  async render(tplKey, familyCtx) { throw new Error('NotImplemented') }
  // familyCtx = { adults, children, elders }
  // return [{ tplItemKey, name, qty, estDays, isRequired, unit }]
}
```

### 4.7 SyncLogRepository (V2 同步日志)

```js
// repositories/interfaces/sync-log.repository.js
class ISyncLogRepository extends IBaseRepository {
  async listPending(limit = 200) { throw new Error('NotImplemented') }
  async markDone(ids) { throw new Error('NotImplemented') }
  async purge(before) { throw new Error('NotImplemented') }
}
```

---

## 5. 本地存储设计 (MVP)

### 5.1 为什么用 Object Store 而不是 SQLite

| 维度 | wx.setStorage (Object Store) | SQLite |
|------|------|------|
| API 复杂度 | 同步、简单 | 异步、需要 SQL |
| 查询能力 | 全量读后 filter | 原生 WHERE |
| 适用数据量 | < 1MB (约 1000 行) | > 1MB |
| V2 迁移 | 接口不变换实现 | 多余；V2 直接用云数据库 |
| 调试 | AppData 可直接看 | 需要 DevTools |

MVP 目标 50-500 件商品 × 1KB = 小于 500KB；**Object Store 够用**。
V2 切换云数据库时 Repository 换实现不改业务代码。

### 5.2 Key 命名约定

```
tbl_{tableName}_{id}             单行读取 O(1)
tbl_{tableName}_idx_{fieldName}  索引表
tbl_{tableName}_meta             元信息 (version, lastId)
```

例：
```
tbl_item_101       → { id: 101, name: '维达棉韧抽纸', ... }
tbl_item_idx_name  → { '维达棉韧抽纸': 101, '德宝加厚纸巾': 102 }
tbl_item_meta      → { lastId: 200, version: 1 }

tbl_family_member  → 单 key 存行 (无 id)
```

### 5.3 存储包装 (防抛 + 序列化 + 日志)

```js
// utils/storage.js
function safeSet(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    // 1. 超限：清掉 audit log
    if (e.errMsg?.includes('limit')) {
      clearAuditLog();
      try { wx.setStorageSync(key, value); return true; } catch (_) {}
    }
    return false;
  }
}

function safeGet(key, fallback = null) {
  try { return wx.getStorageSync(key) ?? fallback; }
  catch { return fallback; }
}
```

---

## 6. ID 生成策略

```js
// utils/id.js
function nextId(tableName) {
  const meta = safeGet(`tbl_${tableName}_meta`, { lastId: 0 });
  meta.lastId += 1;
  safeSet(`tbl_${tableName}_meta`, meta);
  return meta.lastId;   // 自增 number，读写 O(1)
}

// V2 切换 cloud 时改成 UUID:
// function genId() { return `${Date.now()}-${deviceId()}-${rand()}`; }
// 保留原 number ID 业务不变，云侧加 _cloudId 字段
```

**为什么 V1 用自增 number**：
- 序列化友好 (数组 index 即 id)
- 调试时看图直观
- 不用等 time sync
- V2 切换时映射表解决：local 1 → cloud doc "abc"，保留 `oldLocalId` 字段双向映射

---

## 7. 本地 Repository 实现示例

### 7.1 LocalItemRepository

```js
// repositories/local/local.item.repository.js
const Table = 'item';

class LocalItemRepository {
  getById(id) {
    return safeGet(`tbl_${Table}_${id}`);
  }

  findByBarcode(barcode) {
    const idx = safeGet(`tbl_${Table}_idx_barcode`, {});
    const id = idx[barcode];
    return id ? this.getById(id) : null;
  }

  findByTplItemKey(key) {
    const idx = safeGet(`tbl_${Table}_idx_tplKey`, {});
    const id = idx[key];
    return id ? this.getById(id) : null;
  }

  findByNameFuzzy(keyword) {
    if (!keyword) return this.list();
    const idx = safeGet(`tbl_${Table}_idx_name`, {});
    return Object.keys(idx)
      .filter(k => k.toLowerCase().includes(keyword.toLowerCase()))
      .map(name => this.getById(idx[name]))
      .filter(Boolean);
  }

  create(entity) {
    const id = nextId(Table);
    const row = { id, ...entity, created_at: now(), updated_at: now() };
    safeSet(`tbl_${Table}_${id}`, row);
    this._rebuildNameIndex();
    if (entity.barcode) {
      const idx = safeGet(`tbl_${Table}_idx_barcode`, {});
      idx[entity.barcode] = id;
      safeSet(`tbl_${Table}_idx_barcode`, idx);
    }
    if (entity.tpl_item_key) {
      const idx = safeGet(`tbl_${Table}_idx_tplKey`, {});
      idx[entity.tpl_item_key] = id;
      safeSet(`tbl_${Table}_idx_tplKey`, idx);
    }
    return row;
  }

  update(id, patch) {
    const row = this.getById(id);
    if (!row) return null;
    Object.assign(row, patch, { updated_at: now() });
    safeSet(`tbl_${Table}_${id}`, row);
    if (patch.name) this._rebuildNameIndex();
    return row;
  }

  list(filter = {}, { sort = 'updated_at', limit = 200 } = {}) {
    const meta = safeGet(`tbl_${Table}_meta`, { lastId: 0 });
    const rows = [];
    for (let i = 1; i <= meta.lastId; i++) {
      const r = this.getById(i);
      if (!r) continue;
      if (this._matchFilter(r, filter)) rows.push(r);
    }
    rows.sort((a, b) => (a[sort] < b[sort] ? 1 : -1));
    return rows.slice(0, limit);
  }

  _matchFilter(r, filter) {
    return Object.entries(filter).every(([k, v]) => r[k] === v);
  }

  _rebuildNameIndex() {
    const all = this.list({}, { limit: Number.MAX_SAFE_INTEGER });
    const idx = {};
    all.forEach(r => { if (r.name) idx[r.name] = r.id; });
    safeSet(`tbl_${Table}_idx_name`, idx);
  }
}
```

### 7.2 LocalTemplateRepository (读 assets/templates JSON)

```js
// repositories/local/local.template.repository.js
const fsm = wx.getFileSystemManager();

const CACHE_KEY = 'tpl_cache_v1';

class LocalTemplateRepository {
  list() {
    const cached = safeGet(CACHE_KEY);
    if (cached) return cached;
    const tplDir = `${wx.env.USER_DATA_PATH}/templates/`;
    let files = [];
    try { files = fsm.readdirSync(tplDir); } catch { return []; }
    const tpls = files
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return JSON.parse(fsm.readFileSync(tplDir + f, 'utf8')); }
        catch { return null; }
      })
      .filter(Boolean);
    safeSet(CACHE_KEY, tpls);
    return tpls;
  }

  async render(tplKey, { adults = 0, children = 0, elders = 0 } = {}) {
    const all = await this.list();
    const tpl = all.find(t => t.key === tplKey);
    if (!tpl) throw new Error(`tpl not found: ${tplKey}`);
    return tpl.items.map(it => {
      const mult = this._resolveMult(it.qty_mode, { adults, children, elders });
      return {
        tplItemKey: it.key,
        name: it.name,
        qty: Math.round(it.base_qty * mult),
        estDays: it.est_days,
        isRequired: !!it.is_required,
        unit: it.unit || '件',
      };
    });
  }

  _resolveMult(mode, ctx) {
    switch (mode) {
      case 'fixed': return 1;
      case 'per_adult': return ctx.adults;
      case 'per_child': return ctx.children;
      case 'per_elder': return ctx.elders;
      case 'max_adult_child': return Math.max(ctx.adults, ctx.children);
      default: return 0;
    }
  }
}
```

### 7.3 批量事务模版导入 (关键)

用户点"确认导入"时：
1. 读 family_members → ctx
2. 渲染 template → 12 项
3. **每个 item 做 1 次 check-or-create**：
   - 按 tpl_item_key 查 item 表 → 命中: 复用（不会重复）
   - 未命中: INSERT 新 item
4. **每个 item 写 1 行 inventory**
5. 事务：**失败全回滚，不留半罐水**

```js
// services/template.service.js
async function confirmImport(tplKey) {
  const family = await FamilyRepo.getAll();
  const ctx = { adults: 0, children: 0, elders: 0 };
  family.forEach(m => { ctx[m.role] = m.count; });

  const rendered = await TemplateRepo.render(tplKey, ctx);
  const itemRepo = ItemRepo, invRepo = InventoryRepo;

  // Object Store 不支持真 transaction，用"先写影子，最后提交"模拟
  const STAGING = '__import_staging__';
  safeSet(STAGING, { itemIds: [], invIds: [] });

  try {
    const itemIds = [], invIds = [];
    for (const r of rendered) {
      let item = await itemRepo.findByTplItemKey(r.tplItemKey);
      if (!item) {
        item = await itemRepo.create({
          name: r.name, tpl_item_key: r.tplItemKey,
          unit: r.unit, est_days: r.estDays,
        });
      }
      const inv = await invRepo.create({
        item_id: item.id,
        qty: r.qty, remaining: r.qty,
        open_date: today(), status: 'active',
      });
      itemIds.push(item.id); invIds.push(inv.id);
    }
    return invIds;
  } catch (e) {
    // 回滚：删掉本轮写入的 inv + item
    itemIds.forEach(id => itemRepo.delete(id));
    invIds.forEach(id => invRepo.delete(id));
    throw e;
  } finally {
    wx.removeStorageSync(STAGING);
  }
}
```

---

## 8. 数据迁移 Schema (local → cloud 平滑过渡)

### 8.1 本地 schema 打版本号

每条 row 加：

```js
{
  ...fields,
  _schema_version: 1,
  _local_created: "2026-08-04T12:00:00",
  _local_modified: "2026-08-04T12:00:00"
}
```

### 8.2 V2 bootstrapSync() 一次性迁移

| local field | cloud doc field | 处理 |
|-------------|-----------------|------|
| id (number) | doc._id (cloud string) | 映射表 |
| ...cloud字段 | 同名复制 | |
| _schema_version | schema_version | +1 |

迁移完成：用户本地数据 → 云端；后续**云为 master**，本地做缓存+离线草稿。

### 8.3 Repository 工厂 (app.js 注入)

```js
// repositories/index.js
const cfg = require('../config');
module.exports = cfg.CLOUD_ENABLED ? require('./cloud')() : require('./local')();

// app.js
const repos = require('./repositories');
App({
  globalData: { repos },
  onLaunch() {
    AlertService.checkExpiringAndNotify(repos);
  }
});
```

业务代码不变：`const repos = getApp().globalData.repos; repos.inventory.listActive()`

---

## 9. 业务代码不感知本地/云端

**服务层只调 repository 接口**，估算法示例：

```js
// services/item.service.js
class ItemService {
  constructor(repos) { this.repos = repos; }

  async adjustRemaining(invId, newRemaining) {
    const inv = await this.repos.inventory.getById(invId);
    if (!inv) throw new Error('inv not found');
    await this.repos.inventory.update(invId, {
      remaining: newRemaining,
      updated_at: now(),
    });
    return this.repos.inventory.getById(invId);
  }

  calcEstEnd(inv) {
    const { remaining, daily_usage } = inv;
    if (!daily_usage || daily_usage <= 0) return null;
    return now() + (remaining / daily_usage) * 86400000;
  }
}
```

**V2 切换**：设 `CLOUD_ENABLED = true` → factory 返回 cloud 实例 → ItemService 代码零改动。

---

## 10. 缓存与冷启动性能

| 数据 | 冷启动加载策略 | 读频率 |
|------|------|------|
| 首页卡片 (50-200 项) | 全量读到内存 cache | 每次首页 onShow |
| item 详情 | 按 id 读单行 | 每次进详情 |
| family_members | 1 行常驻 App.globalData | 模版渲染时读 |
| location 字典 | 50 行常驻 cache | 保存时读 |
| 模版 JSON | 第一次读后安全缓存到 storage | 罕见 |

**估算冷启动时延**：
- 全量读 200 项 (每项 0.5KB) = 100KB；wx.setStorageSync 同步读 100KB ~= 50ms
- 色点计算：200 次减法 < 1ms
- **MVP 目标冷启动 < 200ms**

---

## 11. V2 扩展点（文件占位，逻辑 NoOp）

V1 开发时**逻辑完整**但**不运行**：

| V1 位置 | V2 替换 | MVP 行为 |
|---------|---------|----------|
| `repositories/cloud/*.js` | 云实现 | 文件存在但不被 factory 选中 |
| `services/sync.service.js` | 双向同步 | `isEnabled() → false` |
| `drivers/cloud.db.driver.js` | 云数据库 driver | 文件存在但不 require |
| `database.rules.json` | 云数据库权限 | 文件存在 |
| 每次写操作 | append sync-log | local 写 user_actions；V2 加写 sync_queue |
| app.js onLaunch | 调 SyncService.pull() | 留 TODO 注释 |

---

## 12. 单元测试策略

```js
// __test__/item.service.test.js
const { ItemService } = require('../services/item.service');
const { MemInventoryRepo } = require('./fakes');

test('adjustRemaining updates quantity', async () => {
  const inv = { id: 1, qty: 10, remaining: 5, daily_usage: 0.2 };
  const repos = { inventory: new MemInventoryRepo([inv]) };
  const svc = new ItemService(repos);
  await svc.adjustRemaining(1, 3);
  expect(repos.inventory.lastUpdate.remaining).toBe(3);
});
```

---

## 13. 开发 Sprint 计划

```
Sprint 0 (本周，架构骨架) — 0.5d
├── app.js + repositories/ (local only)
├── models/* (5 张表 schema)
├── utils/{storage,id,time,estimate}.js
└── unit test scaffold

Sprint 1 (手动录入通) — 3d
├── pages/manual (s5) 完整
├── repositories/local/* (full CRUD)
├── 验收：调整余量 (s1 拖动条)
└── Jest 单元测试过 3 条核心路径

Sprint 2 (扫码 + 4 路径等价) — 3d
├── pages/capture (s2/s3/s4)
├── barcode 匹配离线缓存
├── 联调 wx.scanCode
└── 4 路径等价入库后首页一致

Sprint 3 (模版批量导入) — 3d
├── assets/templates/*.json (4 个文件)
├── services/template.service.js
├── pages/template (s6) + pages/batch (s8)
└── 联动渲染验证

Sprint 4 (首页 + 我的 + 消息) — 3d
├── pages/index (s0) / pages/my (s7)
├── services/alert.service.js
└── requestSubscribeMessage 接入

Sprint 5 (beta 压实) — 3d
├── 外部用户可用性测试
├── 异常路径断网 / 写满 / 空态
├── 内测群上线
└── 启动 V2 Cloud Repository 设计
```

---

_文档版本：v1.0 (2026-08-04) · 作者：CatPaw Architecture_
