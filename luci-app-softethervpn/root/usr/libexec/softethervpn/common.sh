#!/bin/sh
# Shared helpers for luci-app-softethervpn.
#
# All scripts source this file.  It owns the path layout and the only place
# where vpncmd is invoked, so the init script and the rpcd backend cannot
# drift apart.

VPNCMD_BIN="${VPNCMD_BIN:-/usr/bin/vpncmd}"
VPN_SERVER="${VPN_SERVER:-127.0.0.1:5555}"
VPN_STORE="${VPN_STORE:-/usr/libexec/softethervpn}"
VPN_CONF="${VPN_CONF:-$VPN_STORE/vpn_server.config}"
VPN_PWFILE="${VPN_PWFILE:-/etc/softethervpn/management.password}"
VPN_LOG_DIR="${VPN_LOG_DIR:-/tmp/softethervpn/server_log}"

# Some builds install vpncmd next to the server binary instead of /usr/bin.
if [ ! -x "$VPNCMD_BIN" ] && [ -x "$VPN_STORE/vpncmd" ]; then
	VPNCMD_BIN="$VPN_STORE/vpncmd"
fi

TAB=$(printf '\t')

vpn_is_running() {
	pidof vpnserver >/dev/null 2>&1
}

# Run one vpncmd command.  The caller supplies the vpncmd options, normally
#   vpn_exec /CSV /CMD HubList
# Authentication is read from a root-only file; the password never appears in
# a LuCI request or in the process list of the web server.
vpn_exec() {
	if [ -s "$VPN_PWFILE" ]; then
		timeout 25 env LANG=en_US.UTF-8 "$VPNCMD_BIN" "$VPN_SERVER" /SERVER \
			"/PASSWORD:$(head -n 1 "$VPN_PWFILE" | tr -d '\r')" "$@" </dev/null 2>&1
	else
		timeout 25 env LANG=en_US.UTF-8 "$VPNCMD_BIN" "$VPN_SERVER" /SERVER "$@" </dev/null 2>&1
	fi
}

# First meaningful line of a vpncmd failure, for the web UI.
vpn_first_error() {
	printf '%s\n' "$1" | tr -d '\r' | \
		grep -viE '^[[:space:]]*$|^vpncmd|^softether|^copyright|^all rights|^the command completed successfully|^command completed successfully' | \
		head -n 2 | tr '\n' ' '
}

vpn_error_text() {
	local e
	e=$(vpn_first_error "$1")
	[ -n "$e" ] || e="vpncmd failed (exit $2)"
	printf '%s' "$e"
}

# vpncmd /CSV emits RFC-4180-ish CSV.  Convert it to tab separated fields so
# shell/awk can consume it; quoted commas and doubled quotes are handled.
vpn_csv_to_tsv() {
	awk '
	{
		line = $0
		out = ""; f = ""; inq = 0
		for (i = 1; i <= length(line); i++) {
			c = substr(line, i, 1)
			if (inq) {
				if (c == "\"") {
					if (substr(line, i + 1, 1) == "\"") {
						f = f "\""
						i++
					} else {
						inq = 0
					}
				} else {
					f = f c
				}
			} else {
				if (c == "\"") {
					inq = 1
				} else if (c == ",") {
					out = out f "\t"
					f = ""
				} else {
					f = f c
				}
			}
		}
		print out f
	}'
}

# HubList -> one TSV record per hub.
# Columns: name, status, type, users, groups, sessions.
# Rows are selected by position, not by the localized header text.
vpn_hubs_to_file() {
	local file="$1" out rc
	out=$(vpn_exec /CSV /CMD HubList)
	rc=$?
	printf '%s\n' "$out" | tr -d '\r' | vpn_csv_to_tsv | \
		awk -F "$TAB" '
			NF >= 6 && $4 ~ /^[0-9]+$/ && $5 ~ /^[0-9]+$/ && $6 ~ /^[0-9]+$/ {
				print $1 "\t" $2 "\t" $3 "\t" $4 "\t" $5 "\t" $6
			}
		' > "$file"
	return $rc
}

# UserList for one hub -> one TSV record per user.
# Columns: user, full name, group, note, auth, logins, last login, expires.
# Column 6 (login count) is numeric only on data rows, so this also works with
# a localized CSV header.
vpn_users_to_file() {
	local hub="$1" file="$2" out rc
	out=$(vpn_exec /CSV "/HUB:$hub" /CMD UserList)
	rc=$?
	printf '%s\n' "$out" | tr -d '\r' | vpn_csv_to_tsv | \
		awk -F "$TAB" '
			NF >= 8 && $6 ~ /^[0-9]+$/ {
				print $1 "\t" $2 "\t" $3 "\t" $4 "\t" $5 "\t" $6 "\t" $7 "\t" $8
			}
		' > "$file"
	return $rc
}

# ListenerList is a plain table (not CSV), with rows like
#   TCP 443     |Listening
vpn_listeners_to_file() {
	local file="$1" out rc
	out=$(vpn_exec /CMD ListenerList)
	rc=$?
	printf '%s\n' "$out" | tr -d '\r' | awk -F '|' '
		$1 ~ /TCP[ \t]+[0-9]+/ {
			p = $1
			sub(/^.*TCP[ \t]+/, "", p)
			sub(/[^0-9].*$/, "", p)
			s = $2
			gsub(/^[ \t]+|[ \t]+$/, "", s)
			print p "\t" s
		}
	' > "$file"
	return $rc
}

vpn_get_version() {
	local out
	out=$(vpn_exec /CMD ServerInfoGet)
	printf '%s\n' "$out" | tr -d '\r' | awk -F '|' '
		$1 ~ /^[ \t]*Version[ \t]*$/ {
			v = $2
			gsub(/^[ \t]+|[ \t]+$/, "", v)
			print v
			exit
		}
	'
}

vpn_read_autosave() {
	[ -f "$VPN_CONF" ] || return 1
	awk '$1 == "uint" && $2 == "AutoSaveConfigSpan" { print $3; exit }' "$VPN_CONF" | tr -d '\r'
}

vpn_flush() {
	vpn_is_running || { echo "vpnserver is not running"; return 1; }
	vpn_exec /CMD Flush
}

# Change AutoSaveConfigSpan through the server's own ConfigSet/Flush round
# trip.  Editing vpn_server.config in place is not safe: the file carries
# hash fields that ConfigSet validates.
vpn_set_autosave() {
	local seconds="$1" tmp out result rc have cfgout
	case "$seconds" in
		''|*[!0-9]*) echo "invalid interval: $seconds"; return 1 ;;
	esac
	vpn_is_running || { echo "vpnserver is not running"; return 1; }

	tmp=$(mktemp /tmp/softethervpn-autosave.XXXXXX) || return 1
	cfgout=$(mktemp /tmp/softethervpn-configset.XXXXXX) || { rm -f "$tmp"; return 1; }

	out=$(vpn_exec /OUT:"$tmp" /CMD ConfigGet)
	rc=$?
	if [ "$rc" -ne 0 ] || ! grep -q 'AutoSaveConfigSpan' "$tmp" 2>/dev/null; then
		echo "ConfigGet failed: $(vpn_error_text "$out" "$rc")"
		rm -f "$tmp" "$cfgout"
		return 1
	fi

	sed -i "s/AutoSaveConfigSpan [0-9][0-9]*/AutoSaveConfigSpan $seconds/" "$tmp"

	if [ -s "$VPN_PWFILE" ]; then
		printf '%s\n' "$tmp" | timeout 20 env LANG=en_US.UTF-8 "$VPNCMD_BIN" "$VPN_SERVER" /SERVER \
			"/PASSWORD:$(head -n 1 "$VPN_PWFILE" | tr -d '\r')" /CMD ConfigSet > "$cfgout" 2>&1
	else
		printf '%s\n' "$tmp" | timeout 20 env LANG=en_US.UTF-8 "$VPNCMD_BIN" "$VPN_SERVER" /SERVER \
			/CMD ConfigSet > "$cfgout" 2>&1
	fi
	rc=$?
	if [ "$rc" -ne 0 ]; then
		echo "ConfigSet failed: $(vpn_error_text "$(cat "$cfgout")" "$rc")"
		rm -f "$tmp" "$cfgout"
		return 1
	fi
	rm -f "$tmp" "$cfgout"

	sleep 2
	vpn_flush >/dev/null 2>&1
	have=$(vpn_read_autosave)
	echo "requested ${seconds}s; server has: ${have:-unknown}s"
	case "$have" in
		"$seconds") return 0 ;;
	esac
	return 1
}

# Hub and user names accepted by SoftEther and safe as one argv element.
vpn_validate_name() {
	case "$1" in
		''|*[!A-Za-z0-9_.-]*) return 1 ;;
	esac
	[ "${#1}" -le 32 ]
}
