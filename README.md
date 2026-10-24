# luci-app-softethervpn

OpenWrt LuCI feed for **SoftEther VPN 5 Server**（`softethervpn5-server`）。

这是一个**只做服务控制**的插件：显示运行状态、PID、运行时间、开机自启，提供启动、
停止、重启和开机自启开关。HUB、用户、监听端口等配置继续由
**SoftEther VPN Server Manager** 管理。

停止服务或正常重启路由器时，插件会先 `Flush` 再停止 `vpnserver`，确保 Manager 的
配置写入磁盘。

## 加入 feeds.conf.default

在 OpenWrt 源码根目录的 `feeds.conf.default` 末尾追加：

```conf
src-git softethervpn https://github.com/yujun-1982/luci-app-softethervpn.git
```

然后：

```sh
./scripts/feeds update softethervpn
./scripts/feeds install luci-app-softethervpn
```

## 编译

```sh
make menuconfig
# LuCI -> Applications -> luci-app-softethervpn
make package/luci-app-softethervpn/compile V=s
```

同时确认：

```text
Network -> VPN -> softethervpn5-server
```

## 使用

安装后：

```sh
/etc/init.d/rpcd reload
```

进入 **VPN → SoftEther VPN**。页面只有运行状态和启动/停止/重启/开机自启按钮。

推荐配置流程：

1. 用 SoftEther VPN Server Manager 配置 HUB、用户、监听端口。
2. 回插件点一次 **重启**，或正常重启路由器。
3. 需要开机自启时点 **设为开机自启**。

配置文件位于：

```text
/usr/libexec/softethervpn/vpn_server.config
```

已加入 `/etc/sysupgrade.conf`。停止服务时会 `Flush`、`vpnserver stop` 并 `sync`；
`/etc/rc.d/K10softethervpn` 保证即使没设置开机自启，正常重启也会执行停止流程。

## 兼容性

- OpenWrt 23.05 / 24.10 / 25.x，LuCI JS
- 不依赖 `luci-compat`
- 默认依赖 `softethervpn5-server`；如果包名是 `softethervpn-server`，修改
  [`luci-app-softethervpn/Makefile`](luci-app-softethervpn/Makefile) 的 `LUCI_DEPENDS`

## 目录

```text
.
├── feeds.conf.default.example
├── LICENSE
├── README.md
└── luci-app-softethervpn/
    ├── Makefile
    ├── README.md
    ├── htdocs/luci-static/resources/view/softethervpn/overview.js
    ├── po/
    └── root/
```

## License

MIT
