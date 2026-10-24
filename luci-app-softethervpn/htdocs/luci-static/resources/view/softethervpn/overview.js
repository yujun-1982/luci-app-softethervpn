'use strict';
'require view';
'require poll';
'require ui';
'require softethervpn.common as se';

return view.extend({
	load: function() {
		return Promise.all([
			se.invoke(se.callStatus),
			se.invoke(se.callListeners)
		]);
	},

	render: function(data) {
		var self = this;
		var current = {
			running: false,
			boot: false,
			autosave: ''
		};

		var stateBadge = E('span');
		var stateText = E('span');
		var pidText = E('span');
		var uptimeText = E('span');
		var bootBadge = E('span');
		var passwordBadge = E('span');
		var autosaveText = E('span');
		var listenersBody = E('tbody');
		var listenerInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'placeholder': _('Port, e.g. 8443'),
			'style': 'width:12em'
		});

		var startBtn = E('button', {
			'class': 'btn cbi-button cbi-button-apply',
			'click': function() { return act('start'); }
		}, _('Start'));

		var stopBtn = E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'click': function() { return act('stop'); }
		}, _('Stop'));

		var restartBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() { return act('restart'); }
		}, _('Restart'));

		var flushBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() { return act('flush'); }
		}, _('Save config now'));

		var autosaveBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() { return act('apply_autosave'); }
		}, _('Apply auto-save interval'));

		var bootBtn = E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'click': function() {
				return act(current.boot ? 'disable' : 'enable');
			}
		}, _('Enable at boot'));

		function clear(el) {
			while (el.firstChild)
				el.removeChild(el.firstChild);
		}

		function setBadge(el, child) {
			clear(el);
			el.appendChild(child);
		}

		function drawStatus(st) {
			if (!st || st.ok === false)
				return;
			current.running = !!st.running;
			current.boot = !!st.boot;
			current.autosave = st.autosave || '';

			setBadge(stateBadge, se.statusBadge(current.running));
			stateText.textContent = current.running ? _('vpnserver is running') : _('vpnserver is stopped');
			pidText.textContent = current.running && st.pid ? st.pid : '—';
			uptimeText.textContent = current.running ? se.fmtDuration(st.uptime) : '—';
			setBadge(bootBadge, current.boot
				? se.badge(_('Enabled'), 'success')
				: se.badge(_('Disabled'), 'warning'));
			setBadge(passwordBadge, st.password_set
				? se.badge(_('Stored'), 'success')
				: se.badge(_('Not stored'), 'warning'));
			autosaveText.textContent = current.autosave ? '%s s'.format(current.autosave) : '—';

			startBtn.disabled = current.running;
			stopBtn.disabled = !current.running;
			restartBtn.disabled = !current.running;
			bootBtn.textContent = current.boot ? _('Disable at boot') : _('Enable at boot');
		}

		function drawListeners(res) {
			clear(listenersBody);
			if (!res || !res.ok) {
				listenersBody.appendChild(E('tr', {}, [
					E('td', { 'colspan': 3 }, res && res.error ? res.error : _('Cannot read listeners'))
				]));
				return;
			}

			var list = res.listeners || [];
			if (!list.length) {
				listenersBody.appendChild(E('tr', {}, [
					E('td', { 'colspan': 3 }, _('No listeners reported (is the service running?)'))
				]));
				return;
			}

			list.forEach(function(item) {
				var port = item.port;
				var isMgmt = (port == 5555);
				var del = E('button', {
					'class': 'btn cbi-button cbi-button-remove',
					'title': isMgmt ? _('The management listener cannot be removed here') : '',
					'click': function() {
						if (isMgmt || !confirm(_('Delete listener %s?').format(port)))
							return;
						return se.run(se.callListenerDelete, [ port ]).then(refresh);
					}
				}, _('Delete'));
				del.disabled = isMgmt;

				listenersBody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, 'TCP ' + port),
					E('td', { 'class': 'td' }, item.status || '—'),
					E('td', { 'class': 'td' }, isMgmt ? E('em', {}, _('management')) : del)
				]));
			});
		}

		function refresh() {
			return Promise.all([
				se.invoke(se.callStatus),
				se.invoke(se.callListeners)
			]).then(function(res) {
				drawStatus(res[0]);
				drawListeners(res[1]);
			});
		}

		function act(action) {
			startBtn.disabled = stopBtn.disabled = restartBtn.disabled = true;
			return se.run(se.callControl, [ action ]).then(refresh);
		}

		function addListener() {
			var port = (listenerInput.value || '').trim();
			if (!/^[0-9]+$/.test(port) || +port < 1 || +port > 65535) {
				ui.addNotification(null, E('p', {}, _('Enter a port between 1 and 65535')), 'warning');
				return;
			}
			return se.run(se.callListenerAdd, [ port ]).then(function(res) {
				if (res && res.ok)
					listenerInput.value = '';
				return refresh();
			});
		}

		var container = E('div', {}, [
			E('h2', {}, _('SoftEther VPN Server')),

			E('div', { 'class': 'cbi-section' }, [
				E('table', { 'class': 'table' }, [
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td', 'style': 'width:30%' }, _('State')),
						E('td', { 'class': 'td' }, [ stateBadge, ' ', stateText ])
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('PID')),
						E('td', { 'class': 'td' }, pidText)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Uptime')),
						E('td', { 'class': 'td' }, uptimeText)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Start at boot')),
						E('td', { 'class': 'td' }, bootBadge)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Management password')),
						E('td', { 'class': 'td' }, passwordBadge)
					]),
					E('tr', { 'class': 'tr' }, [
						E('td', { 'class': 'td' }, _('Auto-save interval')),
						E('td', { 'class': 'td' }, autosaveText)
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-section-node' }, [
					E('div', { 'class': 'cbi-value' }, [
						E('div', { 'class': 'cbi-value-field' }, [
							startBtn, ' ', stopBtn, ' ', restartBtn, ' ', bootBtn
						])
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('TCP listeners')),
				E('table', { 'class': 'table' }, [
					E('thead', {}, [
						E('tr', { 'class': 'tr' }, [
							E('th', { 'class': 'th' }, _('Port')),
							E('th', { 'class': 'th' }, _('Status')),
							E('th', { 'class': 'th' }, _('Action'))
						])
					]),
					listenersBody
				]),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						listenerInput, ' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-add',
							'click': addListener
						}, _('Add listener'))
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Maintenance')),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						flushBtn, ' ', autosaveBtn
					])
				]),
				E('p', { 'class': 'cbi-section-descr' }, [
					_('SoftEther keeps HUB, user and listener changes in memory until they are flushed or the auto-save interval expires. Use "Save config now" after a batch of changes.'),
					E('br'),
					_('The management password is stored only on this device in /etc/softethervpn/management.password (mode 0600). It is used by vpncmd and is never sent to the browser.')
				])
			]),

			E('div', { 'class': 'alert-message' }, E('p', {}, [
				E('strong', {}, _('Notes')),
				E('br'),
				_('The management listener TCP 5555 is not opened by the default firewall rules. Keep it on the LAN side.'),
				E('br'),
				_('SoftEther\'s default TCP 443 listener conflicts with LuCI/uhttpd HTTPS. Change one of them if HTTPS is enabled.'),
				E('br'),
				_('Config file:'),
				' ',
				E('code', {}, '/usr/libexec/softethervpn/vpn_server.config')
			]))
		]);

		drawStatus(data[0]);
		drawListeners(data[1]);

		if (!data[0] || data[0].ok === false)
			ui.addNotification(null, E('p', {}, data[0] && data[0].error ? data[0].error : _('Cannot read service status')), 'error');

		poll.add(function() {
			var wasRunning = current.running;
			return se.invoke(se.callStatus).then(function(st) {
				if (!st || st.ok === false)
					return;
				drawStatus(st);
				if (wasRunning !== !!st.running)
					return refresh();
			});
		}, 10);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
