# luci-app-softethervpn

一个面向 **SoftEther VPN 5 Server**（`softethervpn5-server`）的 OpenWrt LuCI 插件。它把
SoftEther 的服务控制、虚拟 HUB、用户、TCP 监听端口和日志集中到 LuCI 中，不再需要反复
SSH 到路由器执行 `vpncmd`。

插件参考了 [yujun-1982/LEDE-ni](https://github.com/yujun-1982/LEDE-ni) 中
`luci-app-softether-service` 的 LuCI JS 结构，以及 [superzjg/luci-app-softethervpn](https://github.com/superzjg/luci-app-softethervpn)
对 SoftEther 服务端的配置思路；在此基础上重写为 **rpcd + vpncmd** 后端，避免 LuCI 的
`fs.exec_direct()` 在部分 rpcd ACL 下返回 403 的问题。

## 功能

- **概览**：运行状态、PID、运行时间、开机自启、管理密码是否已保存、自动保存间隔。
- **服务控制**：启动、停止、重启、开机自启开关、立即保存配置（`Flush`）。
- **虚拟 HUB**：创建、删除、查看用户数/会话数、开关 SecureNAT。
- **用户管理**：按 HUB 列出用户，创建密码用户或匿名用户，修改密码，删除用户。
- **监听端口**：列出 TCP 监听端口，添加/删除端口（保留 5555 管理端口）。
- **日志**：查看当天 `server_log`，自动刷新，支持清空。
- **防火墙**：按配置自动创建/启用 WAN 侧 TCP/UDP ACCEPT 规则；停止服务时禁用。
- **配置持久化**：启动时应用语言和自动保存间隔；用户/HUB 变更后立即 `Flush`。
- **中文界面**：内置 `zh_Hans` 翻译。

## 兼容性

| 项目 | 说明 |
| --- | --- |
| OpenWrt | 23.05 / 24.10 / 25.x，使用 LuCI JS（`luci-base`） |
| LuCI | 不依赖 `luci-compat`，不需要 Lua CBI |
| 服务端 | `softethervpn5-server`，二进制位于 `/usr/libexec/softethervpn/` |
| 架构 | `all`（纯脚本 + JS） |

> 如果你的 feed 里服务端包名是 `softethervpn-server` 而不是 `softethervpn5-server`，
> 把 `Makefile` 中的 `LUCI_DEPENDS` 改成 `+softethervpn-server` 即可。二进制路径和
> `vpncmd` 路径保持一致。

## 目录结构

```
luci-app-softethervpn/
├── Makefile
├── README.md
├── LICENSE
├── htdocs/luci-static/resources/softethervpn/
│   └── common.js          # RPC 声明和公共 UI 辅助
├── htdocs/luci-static/resources/view/softethervpn/
│   ├── overview.js        # 服务状态/控制/监听端口
│   ├── hubs.js            # 虚拟 HUB 和用户
│   ├── settings.js        # UCI 设置、管理密码
│   └── logs.js            # 日志
├── po/zh_Hans/softethervpn.po
├── po/zh-cn/softethervpn.po
└── root/
    ├── etc/
    │   ├── config/softethervpn
    │   ├── init.d/softethervpn
    │   └── uci-defaults/90-luci-app-softethervpn
    └── usr/
        ├── libexec/rpcd/luci.softethervpn       # rpcd 后端
        ├── libexec/softethervpn/common.sh       # vpncmd 封装/解析
        ├── libexec/softethervpn/apply-autosave  # 自动保存间隔
        └── share/
            ├── luci/menu.d/luci-app-softethervpn.json
            └── rpcd/acl.d/luci-app-softethervpn.json
```

## 编译

把整个 `luci-app-softethervpn` 目录放到 OpenWrt 源码树或 SDK 的 `package/` 下：

```sh
cp -r luci-app-softethervpn openwrt/package/
cd openwrt
make menuconfig
# LuCI -> Applications -> luci-app-softethervpn
make package/luci-app-softethervpn/compile V=s
```

或者使用 SDK：

```sh
cp -r luci-app-softethervpn sdk/package/
cd sdk
make package/luci-app-softethervpn/compile V=s
```

生成的 ipk 位于 `bin/packages/<arch>/base/` 或 `base/` 目录。

安装：

```sh
opkg install luci-app-softethervpn_*.ipk
/etc/init.d/rpcd reload
```

如果是 apk 包管理的 OpenWrt 25.x，使用对应的 `apk add` 流程；包内容不变。

## 首次使用

1. 确认已安装 `softethervpn5-server`，且 `/usr/libexec/softethervpn/vpnserver` 存在。
2. 进入 **VPN → SoftEther VPN → 概览**，点击 **启动**。
3. 在 **虚拟 HUB** 创建 HUB，再点 **用户** 创建 VPN 用户。
4. 在 **设置** 中确认防火墙端口，必要时重启服务。
5. 如果之后在 SoftEther VPN Server Manager / `vpncmd` 中设置了服务端管理密码，
   到 **设置 → 管理凭据** 把同一个密码保存到本机，否则 HUB/用户/端口操作会因
   `Access denied` 失败。

### 管理密码

`vpncmd` 的 `/PASSWORD:` 从本机文件读取：

```
/etc/softethervpn/management.password
```

权限为 `0600`，目录 `0700`。该文件只保存在设备上，不会通过 LuCI 回传浏览器。
插件不会修改服务端密码；修改服务端密码仍需：

```sh
vpncmd localhost:5555 /SERVER
ServerPasswordSet
```

或在 SoftEther VPN Server Manager 中操作。

### 默认端口与防火墙

SoftEther 默认监听 TCP `443`、`992`、`1194`、`5555`。插件默认只把
`443 992 1194` 加入 WAN 侧防火墙，**不开放 5555**，因为 5555 是管理端口。

- 若 LuCI/uhttpd 已占用 TCP 443，SoftEther 的 443 监听会失败；请修改其中一方。
- UDP 默认放行 `500 4500 1701 1194`，覆盖 L2TP/IPsec 和 OpenVPN UDP。
- 防火墙规则名称为 `SoftEther tcp` / `SoftEther udp`，section 为
  `softether_tcp` / `softether_udp`，可在“网络 → 防火墙”中查看。

## UCI 配置

`/etc/config/softethervpn`：

```uci
config softether 'server'
	option manage_firewall '1'
	option tcp_ports '443 992 1194'
	option udp_ports '500 4500 1701 1194'
	option autosave '300'
	option lang 'en'
```

| 选项 | 说明 |
| --- | --- |
| `manage_firewall` | `1` 自动维护 WAN 侧 ACCEPT 规则；`0` 删除本插件的规则 |
| `tcp_ports` | 空格分隔的 TCP 端口 |
| `udp_ports` | 空格分隔的 UDP 端口 |
| `autosave` | `AutoSaveConfigSpan`，0 表示不修改；建议 300 |
| `lang` | `en` / `cn` / `tw` / `ja`，写入 `lang.config`，重启生效 |

设置页保存到 UCI，但防火墙/语言/自动保存由 init 脚本在服务启动时应用。修改后请到
概览页重启一次服务。

## 后端说明

### 为什么用 rpcd 插件而不是 `fs.exec`

LuCI 的 `fs.exec` 通过 rpcd 的 `file` 对象执行命令，ACL 往往需要逐条列出完整命令行；
带 HUB/用户名参数的动态命令很难枚举，部分构建还会直接返回 403。这里改为：

```
浏览器 --ubus--> rpcd --执行--> /usr/libexec/rpcd/luci.softethervpn --vpncmd--> vpnserver
```

`luci.softethervpn` 是一个可执行的 rpcd 插件：`list` 返回方法签名，`call <method>`
从 stdin 读取 JSON 参数并返回 JSON 结果。LuCI 只看到固定的方法名和参数。

### vpncmd 输出解析

所有列表命令使用 `/CSV`，由 `common.sh` 中的 `vpn_csv_to_tsv` 处理带引号的逗号字段，
再用 `awk` 取列。监听端口和 `ServerInfoGet` 是普通表格，按 `|` 分隔解析。

### 配置持久化

- 运行目录仍是 `/usr/libexec/softethervpn`，与官方 `softethervpn5-server` 一致。
- `server_log` 被链接到 `/tmp/softethervpn/server_log`，避免日志写 flash。
- `vpn_server.config` 已加入 `/etc/sysupgrade.conf`。
- 每次 HUB/用户/端口变更后执行 `Flush`；启动时按 UCI 的 `autosave` 通过
  `ConfigGet`/`ConfigSet` 修改 `AutoSaveConfigSpan`。
- 停止服务时先 `Flush`，再 `vpnserver stop`，最后禁用防火墙规则。

### 与 stock init 的关系

`softethervpn5-server` 自带 `/etc/init.d/softethervpnserver`。本插件使用自己的
`/etc/init.d/softethervpn`，并在 `postinst` 中停止、禁用 stock 脚本，避免两个脚本
同时启动 `vpnserver`。

## 安全建议

- 不要把 TCP 5555 暴露到 WAN；管理操作请走 LAN 或 SSH 隧道。
- LuCI 建议启用 HTTPS；如果 HTTPS 占用 443，请调整 SoftEther 监听端口。
- `management.password` 是明文文件，但权限为 0600；备份/导出配置时注意不要泄露。
- 用户密码在创建时会作为 `vpncmd` 参数短暂出现在进程列表中，这是 `vpncmd` 的限制；
  操作完成后进程立即退出。

## 故障排查

| 现象 | 处理 |
| --- | --- |
| 页面提示 `Object not found` | `/etc/init.d/rpcd reload`，确认 `/usr/libexec/rpcd/luci.softethervpn` 可执行 |
| `Access denied` / `Incorrect password` | 在设置中保存正确的服务端管理密码，或清空后重试 |
| `vpnserver is not running` | 先启动服务；HUB/用户/监听端口操作都要求服务运行 |
| 443 监听失败 | 检查 `netstat -ltnp \| grep :443`，uhttpd 与 SoftEther 只能有一个 |
| 重启后配置丢失 | 确认已执行“立即保存配置”，并检查 `autosave` 是否为 300 |
| 日志为空 | 服务以 daemon 模式运行才有 `server_log`；确认 `/tmp/softethervpn/server_log` 存在 |
| 删除 5555 失败 | 插件禁止删除管理监听端口；需要时用 `vpncmd` 手动操作 |
| 升级插件后服务停止 | `prerm` 会先停止服务，升级完成后到概览页重新启动即可 |

## 许可

MIT，见 [LICENSE](LICENSE)。

本项目不是 SoftEtherVPN 官方项目；SoftEther 是其各自权利人的商标。
