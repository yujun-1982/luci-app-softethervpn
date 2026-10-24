# luci-app-softethervpn

OpenWrt LuCI feed for **SoftEther VPN 5 Server**（`softethervpn5-server`）。

插件提供：服务启停/开机自启、虚拟 HUB、用户、TCP 监听端口、SecureNAT、防火墙规则、
自动保存、管理密码和日志查看。后端使用 rpcd 插件调用 `vpncmd`，不依赖
`fs.exec_direct()`，不要求 `luci-compat`。

## 1. 加入 feeds.conf.default

在 OpenWrt 源码根目录的 `feeds.conf.default` 末尾追加一行：

```conf
src-git softethervpn https://github.com/yujun-1982/luci-app-softethervpn.git
```

也可以直接复制本仓库的 [`feeds.conf.default.example`](feeds.conf.default.example) 中那一行。

然后拉取并安装：

```sh
./scripts/feeds update softethervpn
./scripts/feeds install luci-app-softethervpn
```

## 2. 编译

```sh
make menuconfig
```

在菜单中启用：

```text
LuCI
  └── Applications
        └── <*> luci-app-softethervpn
```

同时确认服务端已选中：

```text
Network
  └── VPN
        └── <*> softethervpn5-server
```

编译：

```sh
make package/luci-app-softethervpn/compile V=s
```

或者直接完整编译：

```sh
make -j$(nproc) V=s
```

## 3. 安装后

```sh
/etc/init.d/rpcd reload
```

进入 LuCI 的 **VPN → SoftEther VPN**。首次使用先点“启动”，再创建虚拟 HUB 和用户。
如果之后设置了服务端管理密码，需要到 **设置 → 管理凭据** 保存同一个密码。

默认防火墙只放行 TCP `443 992 1194` 和 UDP `500 4500 1701 1194`；管理端口 TCP
`5555` 默认不对外开放。

## 目录

```text
.
├── feeds.conf.default.example
├── LICENSE
├── README.md
└── luci-app-softethervpn/
    ├── Makefile
    ├── README.md
    ├── htdocs/
    ├── po/
    └── root/
```

更完整的配置、首次使用、安全建议和排错说明见
[`luci-app-softethervpn/README.md`](luci-app-softethervpn/README.md)。

## 兼容性

- OpenWrt 23.05 / 24.10 / 25.x，LuCI JS
- 服务端包名默认 `softethervpn5-server`；如果使用 `softethervpn-server`，修改
  [`luci-app-softethervpn/Makefile`](luci-app-softethervpn/Makefile) 的 `LUCI_DEPENDS`。
- 架构 `all`，纯脚本 + JS，无需额外编译依赖。

## License

MIT
