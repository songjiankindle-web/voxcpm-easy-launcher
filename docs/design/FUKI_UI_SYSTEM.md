# Fuki UI System

> Fuki 独立孪生版本的系统界面设计语言

| 字段 | 内容 |
| --- | --- |
| 状态 | Draft 1.1 |
| 日期 | 2026-06-30 |
| 适用产品 | Fuki Desktop |
| 设计系统名称 | Fuki |
| 灵感研究对象 | Nintendo 3DS 系统 UI |
| 规范性质 | 原创设计转译，不是 Nintendo UI 复刻 |
| 产品边界 | 仅适用于 Fuki，不定义或修改其他产品的视觉方案 |

## 1. 文档目标

Fuki UI System 是独立孪生版本 **Fuki** 的系统级视觉与交互设计语言。它把 Nintendo 3DS 系统界面中亲切、可触摸、反馈明确的设计气质，转译为适合 Fuki 桌面工作台的原创组件体系。

本文件同时承担四个角色：

1. 记录 3DS 系统 UI 的设计研究结论。
2. 明确 Fuki 的原创边界与设计原则。
3. 规定图标、按钮、弹窗、滑块、动效和声音等基础组件。
4. 给出 Fuki Desktop 的落地方式与验收标准。

这份规范只服务于 Fuki 产品线。它不继承、不覆盖，也不反向修改其他产品的视觉、品牌或组件规范。Fuki 的工作区、导演表、检查器、项目导航和生成队列应当作为 Fuki 自己的界面体系设计与维护。

---

## 2. 研究范围与方法

### 2.1 观察范围

本轮研究覆盖以下 3DS 系统界面：

- HOME Menu 的图标、焦点状态、信息栏和直接操作方式
- System Settings 的入口卡片、列表按钮和分页
- 文件夹与上下文弹窗
- 屏幕亮度分段控件
- 系统键盘、数字键盘和输入模式切换
- 通知列表、未读状态和状态色
- 确认、取消、返回和危险操作
- HOME Menu 主题对背景、图标、音乐和音效的整体影响

### 2.2 资料优先级

研究结论按以下优先级取证：

1. Nintendo 官方操作说明书中的界面截图与操作说明。
2. Nintendo 官方 HOME Menu、主题和布局支持页面。
3. 对公开系统操作录像的设计观察，仅用于补足动效和声音，不视为官方参数。

本文件不会保存或再分发 3DS 系统截图、图标、字体或音频。外部资料只作为研究来源链接存在。

### 2.3 证据与推断的区分

- **已确认事实**：官方资料直接展示或描述的行为，例如图标网格可调整、图标可拖动、主题可以包含图标和音效。
- **设计归纳**：从多个界面中重复出现的视觉特征，例如白色高光、圆角、浅阴影和语义色。
- **Fuki 决策**：为 Fuki 新定义的参数，例如圆角大小、持续时间、声音频率和 CSS token。这些参数不是 Nintendo 的原始参数。

---

## 3. 3DS 系统 UI 的设计 DNA

### 3.1 一句话结论

3DS 系统 UI 把数字控件表现成尺寸小、边界清楚、可以按动的实体物件，并用颜色、位移、声音和动画共同确认操作。

### 3.2 可迁移的核心特征

#### A. 控件首先是“物件”

3DS 的应用图标、菜单按钮、数字键和分页按钮通常具有完整轮廓，而不是只依赖文字或抽象悬停色。控件常见三层结构：

1. 外轮廓或投影，说明边界。
2. 主体表面，承担语义色或中性色。
3. 顶部高光或内侧亮边，表达可按压性。

这让低分辨率屏幕上的触摸目标依然明确。

#### B. 颜色是功能导航，不是装饰涂料

系统基础界面主要使用浅灰和白色，彩色集中出现在应用图标、当前选择、状态提示和功能章节。颜色面积有限，因此具有强定位能力。

对 Fuki 的启示：工作台保持安静，颜色只出现在“可操作、已选择、需要注意、正在发生”的地方。

#### C. 选中状态有体积变化

HOME Menu 中的焦点图标通过彩色外框、放大、浮起或周围空间变化被强调；按钮按下则表现为下沉。状态不是仅改变一档灰色。

#### D. 操作是直接的

图标支持触摸、滑动、长按拖动和重排；亮度使用编号分段；设置列表使用大面积横向按钮。这些设计把系统概念转成直观动作。

#### E. 反馈短、明确、带一点愉快

系统声音和动画不会长时间占据注意力。它们更像标点符号：点击是逗号，确认是句号，完成是一个轻巧的收束。

#### F. 关键状态使用多通道反馈

例如通知可同时通过图标颜色、未读标记和硬件指示灯表达。危险或限制状态也会同时使用颜色、文字和图形，不只依赖单一颜色。

#### G. 个性化覆盖多个感官

Nintendo 官方主题说明明确指出，HOME Menu 主题可以同时包含背景图、图标、背景音乐和音效。这说明“主题”不是换色皮肤，而是视觉与声音共同组成的体验层。

### 3.3 不应迁移的部分

- 双屏结构和掌机硬件隐喻
- HOME Menu 的具体图标网格、顶栏布局和应用入口顺序
- Nintendo、3DS、Mii、HOME Menu 等品牌标识
- 系统图标、字体、主题素材、角色、壁纸与音频文件
- 能让用户误以为 Fuki 与 Nintendo 存在授权关系的整体复刻
- 为触屏和低分辨率硬件形成、但不适合桌面生产工具的过大目标与过低信息密度

---

## 4. Fuki 的设计立场

### 4.1 名称

**Fuki** 是一个独立孪生版本与独立产品身份，**Fuki UI System** 是只作用于该版本的视觉设计方案。它不是其他产品的主题、皮肤、子品牌或可切换外观。

Fuki 的品牌、组件、声音和发布物应当独立管理。其他产品的名称、标志、色板和视觉资产不得被默认带入 Fuki；Fuki 的设计决策也不得反向成为其他产品的默认规范。

Fuki 不作为 Nintendo 风格的市场宣传名称，也不使用“3DS 主题”等容易造成从属或授权误解的表达。

### 4.2 核心命题

> Professional tools can feel alive without becoming toys.
>
> 专业工具可以有生命力，而不必变成玩具。

### 4.3 五条原则

#### 1. Touchable / 可触摸

任何可操作元素都应有可辨认的边界、状态和按压反馈。纯图标按钮也不能像静态装饰。

#### 2. Cheerful restraint / 克制的愉快

高饱和色、弹性动画和提示音只用于重要瞬间。连续编辑区域保持安静，避免把工作流变成游乐场。

#### 3. State has shape / 状态有形状

悬停、聚焦、按下、选中、禁用和错误必须至少通过两种视觉属性区分，例如颜色加位移、轮廓加明度。

#### 4. Sound is punctuation / 声音是标点

声音用于确认离散事件，不为每一个鼠标移动配乐。声音必须短、轻、可关闭，并与视觉状态同步。

#### 5. Fuki stands alone / 独立成形

Fuki 使用自己的产品名称、标志、内容语气和组件资产。任何外部灵感都必须经过重新绘制、重新配色和重新参数化，不依赖其他产品的品牌识别来成立。

---

## 5. 视觉基础

### 5.1 色彩策略

Fuki 采用“中性工作台 + 彩色功能岛”的结构。

#### Light tokens

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--fuki-canvas` | `#F3F5F4` | 应用背景 |
| `--fuki-surface` | `#FFFFFF` | 面板与弹窗 |
| `--fuki-surface-soft` | `#E9EEEC` | 次级面板、轨道 |
| `--fuki-surface-raised` | `#FAFCFB` | 浮起控件表面 |
| `--fuki-ink` | `#27312F` | 主文字 |
| `--fuki-ink-muted` | `#66716E` | 次级文字 |
| `--fuki-line` | `#B8C3C0` | 控件边界 |
| `--fuki-line-soft` | `#D7DEDC` | 面板分隔 |
| `--fuki-focus` | `#43BFA7` | 键盘焦点与主选择 |
| `--fuki-primary` | `#35B89B` | 主要操作 |
| `--fuki-blue` | `#4DAEE8` | 信息、链接、待处理 |
| `--fuki-yellow` | `#F3C84B` | 注意、等待、标记 |
| `--fuki-coral` | `#F47B64` | 错误、破坏性操作 |
| `--fuki-pink` | `#E96BB0` | 特殊模式、个性化 |
| `--fuki-green` | `#5ABB74` | 成功、在线、完成 |

#### Dark tokens

| Token | 建议值 | 用途 |
| --- | --- | --- |
| `--fuki-canvas` | `#171C1B` | 应用背景 |
| `--fuki-surface` | `#222927` | 面板与弹窗 |
| `--fuki-surface-soft` | `#2C3532` | 次级面板、轨道 |
| `--fuki-surface-raised` | `#313B38` | 浮起控件表面 |
| `--fuki-ink` | `#F1F5F3` | 主文字 |
| `--fuki-ink-muted` | `#A9B5B1` | 次级文字 |
| `--fuki-line` | `#56635F` | 控件边界 |
| `--fuki-line-soft` | `#394441` | 面板分隔 |
| `--fuki-focus` | `#61D8BE` | 键盘焦点与主选择 |

#### 使用规则

- 单个视图中除状态色外，最多出现两个强调色。
- 主要按钮只使用 `primary`，不可因页面不同随意换色。
- 错误状态必须同时包含图标或文字，不能只显示珊瑚红。
- 大面积背景降低饱和度，鲜艳颜色留给控件与状态。
- 文本与背景对比度至少满足 WCAG 2.2 AA。

### 5.2 字体

Fuki 不使用或仿制 Nintendo 系统字体。

建议字体栈：

```css
font-family: ui-rounded, "SF Pro Rounded", "SF Pro Text",
  "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif;
```

若某平台没有圆体，使用系统 UI 字体即可。正文可读性优先于“可爱”。

| 角色 | 字号 | 字重 | 行高 |
| --- | ---: | ---: | ---: |
| 页面标题 | 24px | 700 | 32px |
| 面板标题 | 16px | 700 | 24px |
| 控件标签 | 13px | 650 | 18px |
| 正文 | 13px | 450 | 20px |
| 辅助文字 | 11px | 500 | 16px |
| 数值 / 状态 | 12px | 700 | 16px |

英文标题避免全大写。中文不额外增加字间距。

### 5.3 间距

基础单位为 4px。

| Token | 值 |
| --- | ---: |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |

可交互控件最小高度为 32px；常规按钮为 36px；主要操作为 40px。图标按钮最小点击区域为 32 x 32px。

### 5.4 圆角

| Token | 值 | 用途 |
| --- | ---: | --- |
| `radius-xs` | 5px | 徽章、刻度 |
| `radius-sm` | 8px | 输入框、小按钮 |
| `radius-md` | 12px | 常规按钮、卡片 |
| `radius-lg` | 16px | 弹窗、浮层 |
| `radius-pill` | 999px | 滑块头、状态胶囊 |

圆角不是统一拉满。表格单元格和大面积编辑面板保持 8px 或更低，以维持专业和高密度感。

### 5.5 边框、光泽与阴影

Fuki 控件使用“上亮下暗”的轻体积结构：

```css
border: 1px solid var(--fuki-line);
box-shadow:
  inset 0 1px 0 rgb(255 255 255 / 72%),
  0 2px 0 rgb(39 49 47 / 18%),
  0 5px 12px rgb(39 49 47 / 8%);
```

规则：

- 高光只用于可操作控件，不用于普通文本容器。
- 深色模式将高光透明度降至 10%-18%。
- 按下时移除外部 2px 基座阴影，并向下移动 1px。
- 面板阴影比按钮更柔和，禁止所有元素都“浮起来”。
- 禁止厚重玻璃拟态、镜面高光和高噪点纹理。

### 5.6 层级

| Level | 表现 | 示例 |
| --- | --- | --- |
| 0 | 无阴影 | 画布、表格背景 |
| 1 | 1px 边框 | 输入框、列表行 |
| 2 | 短基座阴影 | 按钮、滑块头、图标按钮 |
| 3 | 柔和浮层阴影 | 下拉菜单、Popover |
| 4 | 遮罩 + 浮层阴影 | Modal、危险确认 |

---

## 6. 图标系统

### 6.1 图标性格

Fuki 图标应当像小型工具，而不是细线装饰：

- 主轮廓圆润，端点和拐角使用圆角。
- 16px 图标使用约 1.75px 线宽；20px 使用 2px；24px 使用 2.25px。
- 图形尽量使用单一中心隐喻，减少细碎内部结构。
- 系统图标默认单色；当前功能可使用语义色。
- 大型入口图标可使用“彩色底板 + 深色符号 + 顶部亮边”的两层结构。
- 禁止直接临摹 Nintendo 系统图标的轮廓、色块或内部细节。

### 6.2 图标尺寸

| 场景 | 尺寸 |
| --- | ---: |
| 表格与紧凑工具栏 | 14-16px |
| 常规按钮 | 16-18px |
| 侧栏导航 | 18-20px |
| 空状态与功能入口 | 28-40px |

### 6.3 Fuki 品牌资产

- Fuki 必须建立独立的应用标志、横向标志与图标源文件。
- 不得把其他产品的品牌资产作为 Fuki 的临时或正式标志。
- 在 Fuki 品牌资产获得批准前，原型只使用纯文字 `Fuki` 占位，不擅自绘制临时 Logo。
- 品牌资产一经批准，应指定独立的 canonical source，并在代码、安装包和文档中统一引用。
- Fuki UI 可以为标志提供容器、留白和背景，但不得擅自重绘或改变已批准的标志本体。

### 6.4 图标状态

| 状态 | 变化 |
| --- | --- |
| Default | 中性前景，透明背景 |
| Hover | 柔和色板背景，图标提高明度或饱和度 |
| Pressed | `translateY(1px)`，背景略深 |
| Selected | 2px 语义色环 + 浅色底板 |
| Disabled | 45% 透明度，移除阴影与高光 |
| Attention | 右上角小圆点或徽章，不持续闪烁 |

---

## 7. 组件规范

### 7.1 Button

#### 结构

```text
[ optional icon ] [ label ] [ optional shortcut / count ]
```

#### 类型

| 类型 | 表现 | 使用场景 |
| --- | --- | --- |
| Primary | 品牌绿色实体表面 | 生成、保存、确认 |
| Secondary | 白色/深色浮起表面 | 导入、重试、打开 |
| Quiet | 透明背景，悬停时出现底板 | 工具栏低频操作 |
| Danger | 珊瑚红表面或红色描边 | 删除、清空、覆盖 |
| Icon | 方形或圆角方形 | 紧凑工具栏 |

#### 状态

- Hover：上移不超过 1px，阴影略增强。
- Pressed：下移 1px，基座阴影消失，触发 `press` 音效。
- Focus-visible：2px 外环，环与控件之间留 2px 间隙。
- Loading：标签保持宽度，图标位置显示短循环动画。
- Disabled：不可发声、不可播放按压动画。

按钮不使用无限弹跳。连续快速点击只播放一次确认音，避免声响堆叠。

### 7.2 Dialog / Modal

3DS 的弹窗通常是集中、短文案、清晰双操作。Fuki 保留“像系统询问你一件事”的直接感，但适配桌面窗口。

#### 规格

- 常规宽度：400-520px。
- 最大宽度：`min(560px, calc(100vw - 40px))`。
- 圆角：16px。
- 内边距：24px。
- 标题与正文间距：8px。
- 正文与操作区间距：24px。
- 遮罩：黑色 30%；深色模式 48%。
- 操作按钮通常右对齐；主要操作在最右侧。

#### 类型

- **Inform**：说明信息，单一“知道了”。
- **Confirm**：取消 + 主要操作。
- **Danger**：取消 + 红色破坏性操作，正文明确结果。
- **Progress**：只显示真实进度，不提供无效确认。

#### 动效

- 进入：160ms，透明度 0 -> 1，缩放 0.96 -> 1，Y 6px -> 0。
- 退出：110ms，透明度 1 -> 0，缩放 1 -> 0.98。
- 使用 `cubic-bezier(.2,.8,.2,1)`。
- 错误不抖动整个窗口，只让错误说明横向移动 2px 一次。

#### 文案

标题应表达结果或问题，例如“删除这个片段？”而不是“警告”。按钮写具体动作，例如“删除片段”，不要只写“确定”。

### 7.3 Slider

Fuki 同时定义连续滑块与分段滑块。

#### 连续滑块

- 轨道高度：8px。
- 滑块头：20px 圆形或圆角方形。
- 已完成轨道使用主色，未完成轨道使用 `surface-soft`。
- Hover 时滑块头放大至 22px。
- Drag 时滑块头下沉，数值气泡在上方显示。
- 键盘方向键按小步长调整，`Shift` + 方向键按大步长调整。

适用于语速、音量和连续强度。

#### 分段滑块

- 3-7 个明确档位时优先使用。
- 每个档位必须有标签或刻度值。
- 当前档位形成完整彩色格，而不只是一个小圆点。
- 语速预设可使用“慢 / 标准 / 快”，并显示精确 CPM。

适用于质量等级、预设强度、离散模型参数。

#### 声音

- 只在值跨过有效步长时播放 `tick`。
- 连续拖动最多每 55ms 播放一次。
- 到达最小值或最大值时使用略低或略高的边界音。
- 键盘调整与鼠标调整使用同一声音语义。

### 7.4 Segmented Control

- 2-5 个互斥选项。
- 外容器是浅凹槽，当前项是浮起的小表面。
- 高度 32px 或 36px。
- 切换时当前项移动 140ms，不做弹簧过冲。
- 文本长度差异大时使用等宽分段，避免布局跳动。

适用于声音模式、视图模式、速度预设。

### 7.5 Toggle

- 尺寸 38 x 22px。
- 开启时使用品牌绿色，关闭时使用中性灰。
- 滑块头带 1px 亮边与短阴影。
- 点击整行都可切换，标签必须说明控制对象。
- 切换完成播放 `toggle-on` 或 `toggle-off`，两者音高方向相反。

### 7.6 Input / Textarea

- 默认使用 Level 1，不添加按钮式厚阴影。
- 圆角 8px，边框 1px。
- Focus 时边框使用 `focus`，外环透明度 24%。
- 错误状态在下方显示原因和解决方法。
- 长文本编辑不播放每次按键音。
- 清空、自动转写完成等离散操作可以播放对应反馈音。

### 7.7 Select / Menu / Popover

- 菜单项高度 32-36px。
- 当前选项使用浅色底板和勾选图标。
- 菜单进入动效 120ms，缩放起点不低于 0.98。
- 二级菜单只在确有层级时使用；优先保持一层。
- 破坏性菜单项与普通项之间加入分隔线。

### 7.8 Tooltip

- 只解释图标或补充快捷键，不承载关键流程。
- 延迟 450ms，停留后再次出现可缩短到 120ms。
- 深色实体表面、浅色文字、8px 圆角。
- Tooltip 不播放声音。

### 7.9 Notification / Toast

| 类型 | 图标/颜色 | 声音 |
| --- | --- | --- |
| Info | 蓝色 | 默认无声 |
| Success | 绿色 | `complete` |
| Warning | 黄色 | `attention`，每事件最多一次 |
| Error | 珊瑚红 | `error` |

规则：

- 默认出现在窗口右上角，宽度 320-380px。
- 进入 180ms，退出 140ms。
- 成功提示停留 3 秒；错误提示保持到用户关闭或问题解除。
- 同类生成成功合并为一条，例如“5 个片段已生成”。
- 不同时使用 Toast、弹窗和声音重复宣布同一个低优先级事件。

### 7.10 Progress

- 小于 1 秒的任务不显示进度条。
- 1-10 秒显示紧凑进度或忙碌状态。
- 大于 10 秒显示百分比、当前阶段和取消能力（若可安全取消）。
- 完成时进度条只闪亮一次，不循环发光。
- 批量生成必须显示完成数 / 总数，而不只显示百分比。

### 7.11 Table

导演表是 Fuki 的核心生产界面，不能被卡片化浪潮破坏。

- 行高保持 44-64px，按内容密度选择。
- 表头保持平面，只使用底色和分隔线。
- 当前行使用浅色底板 + 左侧 3px 状态条。
- 行内按钮使用 Quiet 或 Icon 类型。
- 拖拽手柄在 Hover 和 Focus 时才增强对比度。
- 生成中、完成、错误应同时使用图标、颜色和文字/Tooltip。
- 单元格编辑不触发按钮式点击音。

### 7.12 Empty State

- 使用一个原创 Fuki 图标；品牌标志获得批准后，也可以使用 Fuki 标志容器。
- 标题说明当前状态，正文告诉用户下一步。
- 最多提供一个主要操作和一个次要链接。
- 禁止使用 Nintendo 角色、主机轮廓或系统图标作为情绪插图。

---

## 8. 动效系统

### 8.1 时间尺度

| Token | 时间 | 用途 |
| --- | ---: | --- |
| `motion-instant` | 70ms | 按压、刻度反馈 |
| `motion-fast` | 120ms | Hover、菜单、Toggle |
| `motion-standard` | 160ms | 弹窗、选择移动 |
| `motion-gentle` | 220ms | 面板切换、较大内容变化 |
| `motion-celebrate` | 320ms | 一次性完成反馈 |

### 8.2 缓动

```css
--ease-fuki-out: cubic-bezier(.2, .8, .2, 1);
--ease-fuki-press: cubic-bezier(.3, 0, .7, 1);
--ease-fuki-gentle: cubic-bezier(.16, 1, .3, 1);
```

### 8.3 动作语法

| 事件 | 动作 |
| --- | --- |
| Hover | 上移 0-1px，明度提升 |
| Press | 下移 1px，阴影压缩 |
| Select | 外环出现，内容缩放 1 -> 1.025 -> 1 |
| Open | 透明度 + 小幅缩放/位移 |
| Complete | 图标上浮 2px并回落，颜色闪亮一次 |
| Error | 错误说明水平移动 2px 一次 |

### 8.4 无障碍

当 `prefers-reduced-motion: reduce` 生效时：

- 禁止缩放和弹性位移。
- 保留不超过 100ms 的透明度变化。
- 进度状态使用静态图标或低频淡入淡出。
- 不能因为关闭动效而丢失状态信息。

---

## 9. Fuki Sound Language

### 9.1 目标

Fuki 的声音应当轻、圆、短，像控件自身发出的反馈，而不是游戏奖励音。它借鉴“明快的系统交互声”这一抽象方向，但不会采样、复刻或旋律化改编 Nintendo 音频。

### 9.2 原创边界

- 不从 3DS 主机、录像、ROM、主题包或网络资源提取音频。
- 不逐音高复刻可辨认的 Nintendo 提示音。
- 不使用 Nintendo 主题旋律、角色声音或品牌声标。
- 所有声音由 Fuki 项目自行合成或委托原创，并保存参数与源文件。
- 发布前对声音资产做一次“盲听辨识”检查：若听众立即指认某个 Nintendo 原声，应重新设计。

### 9.3 音色原则

- 以正弦波、三角波、柔和木质敲击和极短噪声为基础。
- 主要频段集中在 350-1600Hz，避免尖锐高频。
- 单次点击 25-70ms；确认 90-180ms；完成提示不超过 420ms。
- 短 Attack，快速 Decay，极低 Sustain，无长尾混响。
- 单个 UI 音效峰值建议不高于 -12dBFS；全局主观响度低于内容预览音频。
- 音效不可与用户正在审听的配音样本争夺注意力。

### 9.4 事件表

以下参数是 Fuki 的原创初始方案，需通过真机听感测试调整。

| Event ID | 语义 | 建议结构 | 时长 | 默认策略 |
| --- | --- | --- | ---: | --- |
| `ui.press` | 普通按钮按下 | 620 -> 700Hz 轻上滑，正弦 + 极弱三角 | 45ms | 开启 |
| `ui.select` | 选择条目 | 760Hz 单音，软起音 | 55ms | 开启 |
| `ui.back` | 返回 / 取消 | 620 -> 500Hz 下滑 | 70ms | 开启 |
| `ui.toggle_on` | 开启 | 520Hz + 780Hz 快速双音 | 90ms | 开启 |
| `ui.toggle_off` | 关闭 | 700Hz -> 480Hz 双音 | 90ms | 开启 |
| `ui.tick` | 滑块跨刻度 | 840Hz 极短木质/正弦脉冲 | 22ms | 开启，节流 |
| `ui.boundary_low` | 到达下限 | 420Hz 短音 | 40ms | 开启 |
| `ui.boundary_high` | 到达上限 | 980Hz 短音 | 40ms | 开启 |
| `ui.confirm` | 明确确认 | 560Hz + 760Hz，间隔 45ms | 130ms | 开启 |
| `ui.complete` | 生成 / 导出完成 | 520 / 660 / 820Hz 三音，低音量 | 260ms | 开启 |
| `ui.attention` | 需要注意 | 680Hz 两次轻脉冲 | 150ms | 条件开启 |
| `ui.error` | 操作失败 | 360Hz + 300Hz，柔和双脉冲 | 170ms | 开启 |
| `ui.delete` | 删除已执行 | 440 -> 330Hz，短促无混响 | 100ms | 仅执行后 |

频率只是原型起点，不是固定品牌旋律。最终资产以听感、可辨识度和非侵扰性为准。

### 9.5 触发规则

- 指针按下时可以播放 `press`；业务确认完成后再播放 `confirm` 或 `complete`。
- 如果操作失败，不先播放成功确认音。
- 输入文字、移动光标、选择文本、滚动表格均不发声。
- 滑块与拖拽声音必须节流，连续音效不可叠加。
- 同一事件在 80ms 内重复触发时合并。
- 窗口不在前台时，只允许高优先级完成或错误声音，且遵守用户设置。
- 审听音频播放期间，UI 音效自动降低 6-10dB；拖动音频播放头默认无声。

### 9.6 用户控制

设置项至少包含：

- 界面音效总开关
- 界面音效音量，0%-100%
- “生成完成时提示”独立开关

建议初始音量为 25%。首次使用不播放介绍音。设置变更应即时预听，但每次拖动音量滑块最多每 120ms试听一次。

### 9.7 技术实现建议

Fuki Desktop 可使用 Web Audio API：

- 使用单例 `AudioContext`，首次用户交互后解锁。
- 用 oscillator、gain envelope 和少量 filter 程序化合成原型音效。
- 稳定后可离线渲染为原创 WAV/OGG，以保证跨平台一致。
- 将事件与声音解耦：组件只发出语义事件，不直接选择音频文件。
- 使用全局节流器、防叠音策略和主增益节点。
- 设置写入本地偏好，不上传用户数据。

建议接口：

```ts
type FukiSoundEvent =
  | "ui.press"
  | "ui.select"
  | "ui.back"
  | "ui.toggle_on"
  | "ui.toggle_off"
  | "ui.tick"
  | "ui.boundary_low"
  | "ui.boundary_high"
  | "ui.confirm"
  | "ui.complete"
  | "ui.attention"
  | "ui.error"
  | "ui.delete";

interface FukiSoundPlayer {
  play(event: FukiSoundEvent, options?: { gain?: number }): void;
  setEnabled(enabled: boolean): void;
  setVolume(volume: number): void;
}
```

---

## 10. Fuki 界面组件映射

| Fuki 界面区域 | Fuki UI System 处理 | 保持稳定的产品结构 |
| --- | --- | --- |
| 顶部标题栏 | 状态胶囊、Icon Button、轻按压反馈 | 窗口拖拽与项目切换逻辑 |
| 左侧导航 | 原创圆润图标、选中底板、柔和色条 | 导航层级与项目树 |
| Director Table | 选中行、状态图标、紧凑行内按钮 | 表格结构、拖拽、批量编辑 |
| Inspector | 分段控件、Fuki Slider、Toggle | 参数模型与字段 |
| 生成按钮 | Primary Button、运行/完成声音 | 生成逻辑 |
| Render Bar | 多段进度、完成反馈 | 合并与导出行为 |
| 新建项目弹窗 | Fuki Dialog、明确主次按钮 | 表单内容 |
| 导入弹窗 | Fuki Dialog、文件状态反馈 | 文件解析逻辑 |
| Toast / 错误 | Fuki Notification、语义音效 | 错误信息本身 |
| 主题切换 | Light/Dark token 切换 | 用户偏好持久化 |

### 10.1 优先改造顺序

1. CSS token、Button、Icon Button、Focus Ring。
2. Dialog、Menu、Toast。
3. Slider、Segmented Control、Toggle。
4. Director Table 状态表达。
5. Fuki Sound Player 与设置入口。
6. 完成、错误、批量生成的跨模态反馈。

### 10.2 不在首轮范围

- 重做导航信息架构
- 把导演表改成卡片网格
- 在 UI 改造过程中临时拼凑或频繁更换 Fuki 标志
- 引入角色化吉祥物
- 加入持续背景音乐
- 为每次输入或滚动添加声音

---

## 11. 设计 Token 建议结构

```css
:root {
  --fuki-canvas: #f3f5f4;
  --fuki-surface: #ffffff;
  --fuki-surface-soft: #e9eeec;
  --fuki-surface-raised: #fafcfb;
  --fuki-ink: #27312f;
  --fuki-ink-muted: #66716e;
  --fuki-line: #b8c3c0;
  --fuki-line-soft: #d7dedc;
  --fuki-focus: #43bfa7;
  --fuki-primary: #35b89b;
  --fuki-blue: #4daee8;
  --fuki-yellow: #f3c84b;
  --fuki-coral: #f47b64;
  --fuki-pink: #e96bb0;
  --fuki-green: #5abb74;

  --fuki-radius-xs: 5px;
  --fuki-radius-sm: 8px;
  --fuki-radius-md: 12px;
  --fuki-radius-lg: 16px;

  --fuki-motion-instant: 70ms;
  --fuki-motion-fast: 120ms;
  --fuki-motion-standard: 160ms;
  --fuki-motion-gentle: 220ms;

  --fuki-ease-out: cubic-bezier(.2, .8, .2, 1);
  --fuki-ease-press: cubic-bezier(.3, 0, .7, 1);
  --fuki-ease-gentle: cubic-bezier(.16, 1, .3, 1);
}

:root[data-theme="dark"] {
  --fuki-canvas: #171c1b;
  --fuki-surface: #222927;
  --fuki-surface-soft: #2c3532;
  --fuki-surface-raised: #313b38;
  --fuki-ink: #f1f5f3;
  --fuki-ink-muted: #a9b5b1;
  --fuki-line: #56635f;
  --fuki-line-soft: #394441;
  --fuki-focus: #61d8be;
}
```

最终 token 应在真实界面中进行对比度和层级测试后锁定。本节给出的是实现起点，而非不可修改的品牌色板。

---

## 12. 无障碍与桌面规范

- 所有功能必须支持键盘操作。
- `:focus-visible` 不得被移除或只依赖阴影。
- Icon Button 必须提供可访问名称和 Tooltip。
- 点击目标不小于 32 x 32px，主要操作不小于 36px 高。
- 颜色不作为唯一状态媒介。
- 动画、声音均可被用户关闭。
- 屏幕阅读器应获得状态变化，例如“片段 4 生成完成”。
- 弹窗打开后移动焦点，关闭后恢复到触发控件。
- 危险操作默认不把焦点放在确认按钮上。
- Windows 和 macOS 使用各自熟悉的快捷键表达，不模拟掌机按键标签。

---

## 13. 质量验收

### 13.1 视觉

- [ ] 所有可点击控件都有 Default、Hover、Pressed、Focus、Disabled 状态。
- [ ] 同一视图的圆角、阴影和高光层级一致。
- [ ] 高饱和色只用于操作和状态。
- [ ] Light / Dark 均通过对比度检查。
- [ ] Fuki 只使用独立且已批准的品牌资产，未混用其他产品标志。
- [ ] 未使用 Nintendo 的图标、字体、角色、壁纸或视觉资产。

### 13.2 交互

- [ ] 按下反馈在 70ms 左右开始，操作无迟滞感。
- [ ] 弹窗、菜单和 Toast 的动效方向一致。
- [ ] 滑块支持鼠标、触控板与键盘。
- [ ] 批量生成状态可理解且可恢复。
- [ ] `prefers-reduced-motion` 下功能完整。

### 13.3 声音

- [ ] 所有声音为原创合成或拥有明确授权。
- [ ] 没有声音与 Nintendo 原声达到可辨认的近似。
- [ ] 输入、滚动、普通 Hover 不发声。
- [ ] 滑块声音已节流，不发生密集叠音。
- [ ] 审听音频期间 UI 音量会自动降低。
- [ ] 总开关、音量和完成提示开关可用且持久化。
- [ ] 关闭声音后不影响任何状态理解。

### 13.4 回归

- [ ] Director Table 的信息密度未明显下降。
- [ ] 常用操作的点击次数没有增加。
- [ ] 界面在小窗口下没有溢出或遮挡。
- [ ] Tauri 的 macOS / Windows 构建行为一致。

---

## 14. 知识产权与发布边界

Fuki 的目标是学习抽象设计方法，而不是复制具体表达。

允许：

- 使用圆角、浅阴影、分段控件、明确按压反馈等通用 UI 方法。
- 研究颜色如何承担状态语义、声音如何确认操作。
- 重新定义参数并绘制 Fuki 原创组件。

禁止：

- 直接使用或追踪 Nintendo 3DS 的图标、截图、字体、声音和主题文件。
- 使用可辨认的 Nintendo 声音旋律或音色组合。
- 在营销中暗示 Fuki 是官方 3DS UI、授权主题或 Nintendo 合作产品。
- 使用 Nintendo 的产品名作为 Fuki 功能或主题名称。

Nintendo 官方说明将游戏视觉显示、图形、商标、设计等列为其知识产权的一部分。发布前若界面与某一 3DS 页面在整体观感上过度相近，应重新设计，而不是只替换标志。

---

## 15. 参考资料

访问日期均为 2026-06-30。

### Nintendo 官方资料

1. [Nintendo 3DS XL Operations Manual](https://www.nintendo.com/eu/media/downloads/support_1/nintendo_3ds_14/Nintendo3DSXL_OperationsManual_UK.pdf)
   - HOME Menu：手册页 32-39
   - 软件图标与打开/挂起：手册页 34-35
   - 屏幕亮度分段控件：手册页 37
   - 键盘：手册页 26
   - 通知：手册页 50-51
   - System Settings 与列表按钮：手册页 55-66

2. [Nintendo UK - HOME Menu](https://www.nintendo.com/en-gb/Hardware/Nintendo-3DS-Family/Instant-Software/HOME-Menu/HOME-Menu-115164.html)
   - 官方将 HOME Menu 描述为软件与系统功能的入口，并说明游戏挂起后的快速访问方式。

3. [Nintendo UK - HOME Menu Themes](https://www.nintendo.com/en-gb/Hardware/Nintendo-3DS-Family/Download-Content/HOME-Menu-Themes/HOME-Menu-Themes-923157.html)
   - 官方说明主题可包含背景音乐、背景图、图标和音效。

4. [Nintendo Support - Save and Load HOME Menu Layouts](https://en-americas-support.nintendo.com/app/answers/detail/a_id/14454/~/how-to-save-and-load-home-menu-layouts)
   - 官方说明布局可保存主题、图标排列与文件夹。

5. [Nintendo Support - Themes Overview & FAQ](https://en-americas-support.nintendo.com/app/answers/detail/a_id/12419/~/themes-overview-%26-faq)
   - 主题入口、主题能力和 HOME Menu 个性化说明。

6. [Nintendo Intellectual Property & Piracy FAQ](https://en-americas-support.nintendo.com/app/answers/detail/a_id/55888/~/intellectual-property-%26-piracy-faq)
   - Nintendo 对软件、视觉显示、图形、商标与设计等知识产权范围的说明。

### 法律与通用边界参考

7. [U.S. Copyright Office - What Does Copyright Protect?](https://www.copyright.gov/help/faq/faq-protect.html)
   - 思想、系统和操作方法本身与其具体表达之间的基本区分。

8. [USPTO TMEP 1202.02 - Registration of Trade Dress](https://tmep.uspto.gov/RDMS/TMEP/print?href=TMEP-1200d1e835.html&version=current)
   - 整体外观、颜色组合、纹理与图形可能构成商业外观的通用说明。

---

## 16. 版本记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| Draft 1.1 | 2026-06-30 | 明确 Fuki 是独立孪生版本；移除与其他产品的品牌、组件和资产绑定 |
| Draft 1.0 | 2026-06-30 | 完成 3DS 系统 UI 研究、Fuki 基础规范、组件、动效与声音语言 |
