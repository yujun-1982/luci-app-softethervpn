'use strict';
'require view';
'require rpc';
'require poll';
'require ui';

var callStatus = rpc.declare({
	object: 'luci.softethervpn',
	method: 'status',
	expect: { '': {} }
});

var callControl = rpc.declare({
	object: 'luci.softethervpn',
	method: 'control',
	params: [ 'action' ],
	expect: { '': {} }
});

return view.extend({
	load: function() {
		return callStatus().catch(function(err) {
			return { ok: false, error: err && err.message ? err.message : String(err) };
		});
	},

	render: function(initial) {
		var current = { running: false, boot: false };

		var stateBadge = E('span');
		var stateText = E('span');
		var pidText = E('span');
		var uptimeText = E('span');
		var bootBadge = E('span');
		var errorBox = E('div', {
			'class': 'alert-message error',
			'style': 'display:none;margin-bottom:14px'
		});

		var startBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'click': function() { return act('start'); }
		}, _('启动'));

		var stopBtn = E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'click': function() { return act('stop'); }
		}, _('停止'));

		var restartBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() { return act('restart'); }
		}, _('重启'));

		var bootBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				return act(current.boot ? 'disable' : 'enable');
			}
		}, _('设为开机自启'));

		function clear(el) {
			while (el.firstChild)
				el.removeChild(el.firstChild);
		}

		function setBadge(el, text, kind) {
			clear(el);
			el.appendChild(E('em', { 'class': 'badge ' + (kind || '') }, text));
		}

		function fmtDuration(seconds) {
			seconds = parseInt(seconds, 10);
			if (isNaN(seconds) || seconds < 0)
				return '—';
			var d = Math.floor(seconds / 86400);
			var h = Math.floor((seconds % 86400) / 3600);
			var m = Math.floor((seconds % 3600) / 60);
			var s = seconds % 60;
			if (d > 0) return '%dd %dh %dm'.format(d, h, m);
			if (h > 0) return '%dh %dm'.format(h, m);
			if (m > 0) return '%dm %ds'.format(m, s);
			return '%ds'.format(s);
		}

		function showError(msg) {
			errorBox.textContent = msg || _('无法读取服务状态');
			errorBox.style.display = '';
		}

		function hideError() {
			errorBox.style.display = 'none';
		}

		function setBusy(busy) {
			startBtn.disabled = busy;
			stopBtn.disabled = busy;
			restartBtn.disabled = busy;
			bootBtn.disabled = busy;
		}

		function updateButtons() {
			startBtn.disabled = current.running;
			stopBtn.disabled = !current.running;
			restartBtn.disabled = !current.running;
			bootBtn.disabled = false;
		}

		function apply(st) {
			if (!st || st.ok === false) {
				showError(st && st.error ? st.error : _('无法读取服务状态'));
				return;
			}

			hideError();
			current.running = !!st.running;
			current.boot = !!st.boot;

			setBadge(stateBadge, current.running ? _('运行中') : _('已停止'),
				current.running ? 'success' : 'warning');
			stateText.textContent = current.running ? _('vpnserver 正在运行') : _('vpnserver 已停止');
			pidText.textContent = current.running && st.pid ? st.pid : '—';
			uptimeText.textContent = current.running ? fmtDuration(st.uptime) : '—';
			setBadge(bootBadge, current.boot ? _('已启用') : _('未启用'),
				current.boot ? 'success' : 'warning');

			bootBtn.textContent = current.boot ? _('取消开机自启') : _('设为开机自启');
			updateButtons();
		}

		function act(action) {
			setBusy(true);
			return callControl(action).catch(function(err) {
				return { ok: false, error: err && err.message ? err.message : String(err) };
			}).then(function(res) {
				if (!res || res.ok === false) {
					var msg = res && res.error ? res.error : _('操作失败');
					showError(msg);
					ui.addNotification(null, E('p', {}, msg), 'error');
				}
				return callStatus().catch(function(err) {
					return { ok: false, error: err && err.message ? err.message : String(err) };
				}).then(apply);
			}).then(updateButtons);
		}

		var container = E('div', {}, [
			E('h2', {}, _('SoftEther VPN 服务器')),
			errorBox,

			E('div', { 'class': 'cbi-section' }, [
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width:28%' }, _('运行状态')),
						E('td', { 'class': 'td' }, [ stateBadge, ' ', stateText ])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('PID')),
						E('td', { 'class': 'td' }, pidText)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('运行时间')),
						E('td', { 'class': 'td' }, uptimeText)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('开机自启')),
						E('td', { 'class': 'td' }, bootBadge)
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						startBtn, ' ', stopBtn, ' ', restartBtn, ' ', bootBtn
					])
				])
			]),

			E('div', { 'class': 'alert-message' }, E('p', {}, [
				_('用 SoftEther VPN Server Manager 修改 HUB、用户或监听端口后，请点“重启”，或在正常重启路由器前等待几秒；停止服务时会把内存中的配置写入磁盘。'),
				E('br'),
				_('配置文件：'),
				' ',
				E('code', {}, '/usr/libexec/softethervpn/vpn_server.config')
			]))
		]);

		apply(initial);
		updateButtons();

		poll.add(function() {
			if (startBtn.disabled && stopBtn.disabled && restartBtn.disabled && bootBtn.disabled)
				return;
			return callStatus().catch(function(err) {
				return { ok: false, error: err && err.message ? err.message : String(err) };
			}).then(apply);
		}, 5);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
