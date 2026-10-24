# luci-app-softethervpn

一个 **只做服务控制** 的 OpenWrt LuCI 插件，面向 `softethervpn5-server`：

- 显示运行状态、PID、运行时间、开机自启状态
- 启动、停止、重启服务
- 设置/取消开机自启
- 用 SoftEther VPN Server Manager 配好 HUB、用户、监听端口后，停止服务或正常重启路由器时自动把配置写盘
- 主包内置中文，无需额外安装 `luci-i18n-softethervpn-*`

HUB、用户、监听端口、SecureNAT 等配置仍然由 **SoftEther VPN Server Manager**
或 `vpncmd` 完成；本插件不重复实现这些管理页面。

## 兼容性

| 项目 | 说明 |
| --- | --- |
| OpenWrt | 23.05 / 24.10 / 25.x，LuCI JS |
| LuCI | 不依赖 `luci-compat`，不需要 Lua CBI |
| 服务端 | `softethervpn5-server`，二进制位于 `/usr/libexec/softethervpn/` |
| 架构 | `all`（纯脚本 + JS） |

> 如果服务端包名是 `softethervpn-server`，把 `Makefile` 中的
> `LUCI_DEPENDS` 改成 `+softethervpn-server`。

## 编译

把整个 `luci-app-softethervpn` 目录放到 OpenWrt 源码或 SDK 的 `package/` 下：

```sh
cp -r luci-app-softethervpn openwrt/package/
cd openwrt
make menuconfig
# LuCI -> Applications -> luci-app-softethervpn
make package/luci-app-softethervpn/compile V=s
```

## 安装后

```sh
/etc/init.d/rpcd reload
```

进入 **VPN → SoftEther VPN**。页面只有：

- 运行状态
- PID / 运行时间
- 开机自启
- 启动 / 停止 / 重启 / 开机自启开关

## 配置持久化

配置文件：

```text
/usr/libexec/softethervpn/vpn_server.config
```

保存策略：

1. **停止服务时自动 `Flush`**，然后执行 `vpnserver stop`，再 `sync`。
2. **正常重启/关机**时，`/etc/rc.d/K10softethervpn` 会调用停止流程，即使没有设置开机自启也会执行。
3. 服务运行时 `AutoSaveConfigSpan` 默认为 300 秒，最多 5 分钟的配置改动会由 SoftEther 自己写盘。
4. 配置文件已加入 `/etc/sysupgrade.conf`，系统升级时保留。

推荐流程：

1. 用 SoftEther VPN Server Manager 配置 HUB、用户、监听端口。
2. 回到插件点一次 **重启**（或正常重启路由器），让配置立即写盘。
3. 需要开机自动启动时，点 **设为开机自启**。

> 直接用虚拟机“强制断电/Reset”不会走停止流程；这种情况下最多可能丢失最近 5 分钟的配置改动。

## 与 stock init 的关系

`softethervpn5-server` 自带 `/etc/init.d/softethervpnserver`。本插件使用自己的
`/etc/init.d/softethervpn`，安装时会停止并禁用 stock 脚本，避免两个服务同时启动。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| 页面空白或 `XHR request timed out` | 关闭旧标签页，用无痕窗口重新打开；确认 `/etc/init.d/rpcd` 正在运行 |
| `TCP 443 Error` | uhttpd 已占用 443，SoftEther 的 443 监听起不来；改 SoftEther 监听端口或关闭 LuCI HTTPS |
| 重启后配置丢失 | 用插件“重启”一次，或正常重启路由器；不要用强制 Reset |
| 修改了 Manager 配置但插件看不到 HUB | 插件不再管理 HUB；请以 Manager 为准，点“重启”写盘 |
| 页面仍是旧样式 | `sessionStorage.clear(); location.reload();` 或清站点数据 |

## 文件结构

```text
luci-app-softethervpn/
├── Makefile
├── README.md
├── LICENSE
├── htdocs/luci-static/resources/view/softethervpn/overview.js
├── po/zh_Hans/softethervpn.po
├── po/zh-cn/softethervpn.po
└── root/
    ├── etc/
    │   ├── config/softethervpn
    │   ├── init.d/softethervpn
    │   └── uci-defaults/90-luci-app-softethervpn
    └── usr/
        ├── lib/lua/luci/i18n/*.lmo
        ├── libexec/rpcd/luci.softethervpn
        ├── libexec/softethervpn/common.sh
        ├── libexec/softethervpn/apply-autosave
        └── share/
            ├── luci/menu.d/luci-app-softethervpn.json
            └── rpcd/acl.d/luci-app-softethervpn.json
```

## License

MIT
