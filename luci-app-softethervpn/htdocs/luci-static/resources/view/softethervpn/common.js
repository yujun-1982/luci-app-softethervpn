'use strict';
'require rpc';
'require ui';

/*
 * Shared RPC declarations and small formatting helpers for the SoftEther VPN
 * views.  The backend is the rpcd script /usr/libexec/rpcd/luci.softethervpn.
 */

var callStatus = rpc.declare({
	object: 'luci.softethervpn',
	method: 'status',
	expect: { '': {} }
});

var callListeners = rpc.declare({
	object: 'luci.softethervpn',
	method: 'listeners',
	expect: { '': {} }
});

var callHubs = rpc.declare({
	object: 'luci.softethervpn',
	method: 'hubs',
	expect: { '': {} }
});

var callUsers = rpc.declare({
	object: 'luci.softethervpn',
	method: 'users',
	params: [ 'hub' ],
	expect: { '': {} }
});

var callLogs = rpc.declare({
	object: 'luci.softethervpn',
	method: 'logs',
	params: [ 'lines' ],
	expect: { '': {} }
});

var callControl = rpc.declare({
	object: 'luci.softethervpn',
	method: 'control',
	params: [ 'action' ],
	expect: { '': {} }
});

var callSavePassword = rpc.declare({
	object: 'luci.softethervpn',
	method: 'save_password',
	params: [ 'password' ],
	expect: { '': {} }
});

var callClearPassword = rpc.declare({
	object: 'luci.softethervpn',
	method: 'clear_password',
	expect: { '': {} }
});

var callHubAdd = rpc.declare({
	object: 'luci.softethervpn',
	method: 'hub_add',
	params: [ 'name', 'password' ],
	expect: { '': {} }
});

var callHubDelete = rpc.declare({
	object: 'luci.softethervpn',
	method: 'hub_delete',
	params: [ 'name' ],
	expect: { '': {} }
});

var callHubSecurenat = rpc.declare({
	object: 'luci.softethervpn',
	method: 'hub_securenat',
	params: [ 'hub', 'enable' ],
	expect: { '': {} }
});

var callUserAdd = rpc.declare({
	object: 'luci.softethervpn',
	method: 'user_add',
	params: [ 'hub', 'name', 'password', 'auth', 'note' ],
	expect: { '': {} }
});

var callUserDelete = rpc.declare({
	object: 'luci.softethervpn',
	method: 'user_delete',
	params: [ 'hub', 'name' ],
	expect: { '': {} }
});

var callUserPassword = rpc.declare({
	object: 'luci.softethervpn',
	method: 'user_password',
	params: [ 'hub', 'name', 'password' ],
	expect: { '': {} }
});

var callListenerAdd = rpc.declare({
	object: 'luci.softethervpn',
	method: 'listener_add',
	params: [ 'port' ],
	expect: { '': {} }
});

var callListenerDelete = rpc.declare({
	object: 'luci.softethervpn',
	method: 'listener_delete',
	params: [ 'port' ],
	expect: { '': {} }
});

var callLogClear = rpc.declare({
	object: 'luci.softethervpn',
	method: 'log_clear',
	expect: { '': {} }
});

function invoke(fn, args) {
	return fn.apply(null, args || []).catch(function(err) {
		return { ok: false, error: err && err.message ? err.message : String(err) };
	});
}

function notifyError(res) {
	var msg = res && (res.error || res.message) ? (res.error || res.message) : _('Unknown error');
	ui.addNotification(null, E('p', {}, msg), 'error');
	return res;
}

function notifyResult(res) {
	if (!res || !res.ok)
		return notifyError(res);

	if (res.message)
		ui.addNotification(null, E('p', {}, res.message), 'success');

	return res;
}

function run(fn, args) {
	return invoke(fn, args).then(function(res) {
		return notifyResult(res);
	});
}

function fmtDuration(seconds) {
	seconds = parseInt(seconds, 10);
	if (isNaN(seconds) || seconds < 0)
		return '—';

	var d = Math.floor(seconds / 86400);
	var h = Math.floor((seconds % 86400) / 3600);
	var m = Math.floor((seconds % 3600) / 60);
	var s = seconds % 60;

	if (d > 0)
		return '%dd %dh %dm'.format(d, h, m);
	if (h > 0)
		return '%dh %dm'.format(h, m);
	if (m > 0)
		return '%dm %ds'.format(m, s);
	return '%ds'.format(s);
}

function badge(text, kind) {
	return E('em', { 'class': 'badge ' + (kind || '') }, text);
}

function statusBadge(running) {
	return running
		? badge(_('Running'), 'success')
		: badge(_('Stopped'), 'warning');
}

return {
	callStatus: callStatus,
	callListeners: callListeners,
	callHubs: callHubs,
	callUsers: callUsers,
	callLogs: callLogs,
	callControl: callControl,
	callSavePassword: callSavePassword,
	callClearPassword: callClearPassword,
	callHubAdd: callHubAdd,
	callHubDelete: callHubDelete,
	callHubSecurenat: callHubSecurenat,
	callUserAdd: callUserAdd,
	callUserDelete: callUserDelete,
	callUserPassword: callUserPassword,
	callListenerAdd: callListenerAdd,
	callListenerDelete: callListenerDelete,
	callLogClear: callLogClear,
	invoke: invoke,
	run: run,
	notifyError: notifyError,
	notifyResult: notifyResult,
	fmtDuration: fmtDuration,
	badge: badge,
	statusBadge: statusBadge
};
