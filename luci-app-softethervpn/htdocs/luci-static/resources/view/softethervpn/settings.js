'use strict';
'require form';
'require view';
'require ui';
'require softethervpn.common as se';

return view.extend({
	load: function() {
		return se.invoke(se.callStatus);
	},

	render: function(st) {
		st = st || {};

		var m = new form.Map('softethervpn', _('SoftEther VPN Server'),
			_('Service, firewall and SoftEther runtime settings. Changes are stored in UCI; restart the service to apply firewall, language and auto-save changes.'));

		var s = m.section(form.NamedSection, 'server', 'softether', _('Service'));
		s.anonymous = true;

		var o = s.option(form.Flag, 'manage_firewall', _('Manage firewall rules'),
			_('Create and maintain ACCEPT rules in the WAN zone for the TCP and UDP ports below. Rules are enabled while the service is running.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'tcp_ports', _('TCP ports to open'),
			_('Space-separated list. The default is 443 992 1194. TCP 5555 is the management listener and is intentionally not opened.'));
		o.placeholder = '443 992 1194';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			return validatePorts(value);
		};

		o = s.option(form.Value, 'udp_ports', _('UDP ports to open'),
			_('Space-separated list for L2TP/IPsec and OpenVPN UDP. The default is 500 4500 1701 1194.'));
		o.placeholder = '500 4500 1701 1194';
		o.rmempty = false;
		o.validate = function(section_id, value) {
			return validatePorts(value);
		};

		o = s.option(form.Value, 'autosave', _('Auto-save interval (seconds)'),
			_('SoftEther writes its configuration to disk after this many seconds. 0 leaves the server value untouched. The server may clamp the value to its own minimum (often 300).'));
		o.placeholder = '300';
		o.validate = function(section_id, value) {
			if (value === '' || value == null)
				return true;
			if (!/^[0-9]+$/.test(value) || +value > 604800)
				return _('Enter a number between 0 and 604800');
			return true;
		};

		o = s.option(form.ListValue, 'lang', _('Server language'),
			_('Language used by vpncmd and the server log. A restart is required.'));
		o.value('en', 'English');
		o.value('cn', '简体中文');
		o.value('tw', '繁體中文');
		o.value('ja', '日本語');
		o.default = 'en';

		var p = m.section(form.NamedSection, 'server', 'softether', _('Management credentials'));
		p.anonymous = true;

		var status = p.option(form.DummyValue, '_password_status', _('Stored password'));
		status.cfgvalue = function() {
			return st.password_set ? _('Stored') : _('Not stored');
		};

		var store = p.option(form.Button, '_store_password', _('Store password'));
		store.inputstyle = 'apply';
		store.onclick = function() {
			showPasswordModal();
			return false;
		};

		var clear = p.option(form.Button, '_clear_password', _('Clear stored password'));
		clear.inputstyle = 'remove';
		clear.onclick = function() {
			if (!confirm(_('Remove the stored management password?')))
				return false;
			se.run(se.callClearPassword).then(function(res) {
				if (res && res.ok)
					location.reload();
			});
			return false;
		};

		var r = m.section(form.NamedSection, 'server', 'softether', _('Apply'));
		r.anonymous = true;

		var restart = r.option(form.Button, '_restart', _('Restart service now'));
		restart.inputstyle = 'apply';
		restart.onclick = function() {
			se.run(se.callControl, [ 'restart' ]);
			return false;
		};

		var note = r.option(form.DummyValue, '_note', '');
		note.cfgvalue = function() {
			return _('Firewall rules and the server language are applied by the init script on start or restart.');
		};

		return m.render();
	}
});

function validatePorts(value) {
	if (value === '' || value == null)
		return true;

	var parts = String(value).trim().split(/\s+/);
	for (var i = 0; i < parts.length; i++) {
		if (!/^[0-9]+$/.test(parts[i]) || +parts[i] < 1 || +parts[i] > 65535)
			return _('Use space-separated ports between 1 and 65535');
	}
	return true;
}

function showPasswordModal() {
	var input = E('input', {
		'type': 'password',
		'class': 'cbi-input-text',
		'style': 'width:100%',
		'placeholder': _('Current SoftEther server management password')
	});

	ui.showModal(_('Store management password'), [
		E('p', {}, _('This only stores the password locally for vpncmd. It does not change the password on the SoftEther server. Use the SoftEther VPN Server Manager or vpncmd ServerPasswordSet to change it.')),
		input,
		E('div', { 'class': 'right', 'style': 'margin-top:1em' }, [
			E('button', {
				'class': 'btn',
				'click': function() { ui.hideModal(); }
			}, _('Cancel')),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-apply',
				'click': function() {
					if (!input.value) {
						ui.addNotification(null, E('p', {}, _('Password must not be empty')), 'warning');
						return;
					}
					return se.run(se.callSavePassword, [ input.value ]).then(function(res) {
						if (res && res.ok) {
							ui.hideModal();
							location.reload();
						}
					});
				}
			}, _('Save'))
		])
	]);
}
