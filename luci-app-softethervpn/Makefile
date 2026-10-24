include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-softethervpn
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_LICENSE:=MIT
PKG_MAINTAINER:=OpenWrt LuCI community

LUCI_TITLE:=LuCI support for the SoftEther VPN Server
LUCI_DESCRIPTION:=Web control panel for softethervpn5-server: service state, virtual HUBs, users, listeners and logs.
LUCI_DEPENDS:=+luci-base +rpcd +jshn +kmod-tun +softethervpn5-server
LUCI_PKGARCH:=all

define Package/$(PKG_NAME)/conffiles
/etc/config/softethervpn
endef

define Package/$(PKG_NAME)/postinst
#!/bin/sh
ROOT="$${IPKG_INSTROOT}"

# Ensure modes even when the package was assembled from an archive that lost
# the executable bits.
chmod 0755 "$${ROOT}/etc/init.d/softethervpn" 2>/dev/null
chmod 0755 "$${ROOT}/usr/libexec/rpcd/luci.softethervpn" 2>/dev/null
chmod 0755 "$${ROOT}/usr/libexec/softethervpn/apply-autosave" 2>/dev/null
chmod 0644 "$${ROOT}/usr/libexec/softethervpn/common.sh" 2>/dev/null
chmod 0755 "$${ROOT}/etc/uci-defaults/90-luci-app-softethervpn" 2>/dev/null
mkdir -p "$${ROOT}/etc/softethervpn"
chmod 0700 "$${ROOT}/etc/softethervpn"

if [ -z "$${IPKG_INSTROOT}" ]; then
	# Only one init script may own vpnserver.
	[ -x /etc/init.d/softethervpnserver ] && /etc/init.d/softethervpnserver stop >/dev/null 2>&1
	[ -x /etc/init.d/softethervpnserver ] && /etc/init.d/softethervpnserver disable >/dev/null 2>&1
	[ -x /etc/init.d/rpcd ] && /etc/init.d/rpcd reload >/dev/null 2>&1
fi
exit 0
endef

define Package/$(PKG_NAME)/prerm
#!/bin/sh
if [ -z "$${IPKG_INSTROOT}" ]; then
	[ -x /etc/init.d/softethervpn ] && /etc/init.d/softethervpn stop >/dev/null 2>&1
fi
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
