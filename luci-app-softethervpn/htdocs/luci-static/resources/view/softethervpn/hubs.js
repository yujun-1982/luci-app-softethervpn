'use strict';
'require view';
'require ui';
'require view.softethervpn.common as se';

return view.extend({
	load: function() {
		return se.invoke(se.callHubs);
	},

	render: function(initial) {
		var state = {
			hubs: [],
			selected: null,
			users: null,
			error: null
		};

		var hubTableBox = E('div');
		var usersBox = E('div');

		var hubNameInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'text',
			'placeholder': _('New HUB name'),
			'style': 'width:14em'
		});

		var hubPassInput = E('input', {
			'class': 'cbi-input-text',
			'type': 'password',
			'placeholder': _('HUB admin password (optional)'),
			'style': 'width:18em'
		});

		var addHubBtn = E('button', {
			'class': 'btn cbi-button cbi-button-add',
			'click': addHub
		}, _('Create HUB'));

		function clear(el) {
			while (el.firstChild)
				el.removeChild(el.firstChild);
		}

		function validName(name) {
			return /^[A-Za-z0-9_.-]{1,32}$/.test(name);
		}

		function hashHub() {
			var m = (location.hash || '').match(/^#hub=(.+)$/);
			if (!m)
				return null;
			try {
				return decodeURIComponent(m[1]);
			} catch (e) {
				return null;
			}
		}

		function setHash(name) {
			if (!name) {
				try {
					history.replaceState(null, '', location.pathname + location.search);
				} catch (e) {
					location.hash = '';
				}
				return;
			}
			try {
				history.replaceState(null, '', '#hub=' + encodeURIComponent(name));
			} catch (e) {
				location.hash = 'hub=' + encodeURIComponent(name);
			}
		}

		function drawHubs() {
			clear(hubTableBox);

			if (state.error) {
				hubTableBox.appendChild(E('div', { 'class': 'alert-message error' }, state.error));
				return;
			}

			var table = E('table', { 'class': 'table' }, [
				E('thead', {}, [
					E('tr', { 'class': 'tr' }, [
						E('th', { 'class': 'th' }, _('HUB')),
						E('th', { 'class': 'th' }, _('Status')),
						E('th', { 'class': 'th' }, _('Users')),
						E('th', { 'class': 'th' }, _('Sessions')),
						E('th', { 'class': 'th' }, _('Actions'))
					])
				])
			]);

			var tbody = E('tbody');
			if (!state.hubs.length) {
				tbody.appendChild(E('tr', {}, [
					E('td', { 'colspan': 5 }, _('No virtual HUBs found. Create one below.'))
				]));
			}

			state.hubs.forEach(function(hub) {
				var offline = /offline|离线|停止|不在线/i.test(String(hub.status || ''));
				tbody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, E('strong', {}, hub.name)),
					E('td', { 'class': 'td' }, se.badge(hub.status || '—', offline ? 'warning' : 'success')),
					E('td', { 'class': 'td' }, String(hub.users || 0)),
					E('td', { 'class': 'td' }, String(hub.sessions || 0)),
					E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { selectHub(hub.name); }
						}, _('Users')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { return securenat(hub.name, 1); }
						}, _('NAT on')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { return securenat(hub.name, 0); }
						}, _('NAT off')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'click': function() { return deleteHub(hub.name); }
						}, _('Delete'))
					])
				]));
			});

			table.appendChild(tbody);
			hubTableBox.appendChild(table);
		}

		function drawUsers() {
			clear(usersBox);

			if (!state.selected) {
				usersBox.appendChild(E('p', { 'class': 'cbi-section-descr' },
					_('Select "Users" on a HUB to list, create and delete its VPN users.')));
				return;
			}

			usersBox.appendChild(E('h3', {}, _('Users in %s').format(state.selected)));
			usersBox.appendChild(E('p', { 'class': 'cbi-section-descr' },
				_('User changes are written to the running server immediately and flushed to disk.')));

			if (state.users === null) {
				usersBox.appendChild(E('p', { 'class': 'cbi-section-descr' }, _('Loading...')));
				return;
			}

			if (!state.users || !state.users.ok) {
				usersBox.appendChild(E('div', { 'class': 'alert-message error' },
					state.users && state.users.error ? state.users.error : _('Cannot read users')));
				return;
			}

			var users = state.users.users || [];
			var table = E('table', { 'class': 'table' }, [
				E('thead', {}, [
					E('tr', { 'class': 'tr' }, [
						E('th', { 'class': 'th' }, _('User')),
						E('th', { 'class': 'th' }, _('Full name')),
						E('th', { 'class': 'th' }, _('Auth')),
						E('th', { 'class': 'th' }, _('Logins')),
						E('th', { 'class': 'th' }, _('Last login')),
						E('th', { 'class': 'th' }, _('Actions'))
					])
				])
			]);
			var tbody = E('tbody');

			if (!users.length) {
				tbody.appendChild(E('tr', {}, [
					E('td', { 'colspan': 6 }, _('No users in this HUB.'))
				]));
			}

			users.forEach(function(user) {
				tbody.appendChild(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td' }, E('strong', {}, user.name)),
					E('td', { 'class': 'td' }, user.full || '—'),
					E('td', { 'class': 'td' }, user.auth || '—'),
					E('td', { 'class': 'td' }, user.logins || '0'),
					E('td', { 'class': 'td' }, user.last || '—'),
					E('td', { 'class': 'td', 'style': 'white-space:nowrap' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': function() { showUserPassword(user.name); }
						}, _('Password')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'click': function() { return deleteUser(user.name); }
						}, _('Delete'))
					])
				]));
			});

			table.appendChild(tbody);
			usersBox.appendChild(table);

			var userName = E('input', {
				'class': 'cbi-input-text',
				'type': 'text',
				'placeholder': _('User name'),
				'style': 'width:10em'
			});
			var userPass = E('input', {
				'class': 'cbi-input-text',
				'type': 'password',
				'placeholder': _('Password'),
				'style': 'width:12em'
			});
			var userAuth = E('select', { 'class': 'cbi-input-select' }, [
				E('option', { 'value': 'password' }, _('Password')),
				E('option', { 'value': 'anonymous' }, _('Anonymous'))
			]);
			var userNote = E('input', {
				'class': 'cbi-input-text',
				'type': 'text',
				'placeholder': _('Note (optional)'),
				'style': 'width:14em'
			});

			userAuth.addEventListener('change', function() {
				userPass.disabled = (userAuth.value === 'anonymous');
			});

			usersBox.appendChild(E('div', { 'class': 'cbi-value' }, [
				E('div', { 'class': 'cbi-value-field' }, [
					userName, ' ', userPass, ' ', userAuth, ' ', userNote, ' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-add',
						'click': function() {
							return addUser(userName, userPass, userAuth, userNote);
						}
					}, _('Add user'))
				])
			]));
		}

		function refresh() {
			return se.invoke(se.callHubs).then(function(res) {
				if (!res || !res.ok) {
					state.error = res && res.error ? res.error : _('Cannot read virtual HUBs');
					state.hubs = [];
					drawHubs();
					return;
				}
				state.error = null;
				state.hubs = res.hubs || [];

				if (state.selected && !state.hubs.some(function(h) { return h.name === state.selected; })) {
					state.selected = null;
					state.users = null;
					setHash(null);
				}
				drawHubs();
				if (state.selected)
					return loadUsers(state.selected);
				drawUsers();
			});
		}

		function loadUsers(name) {
			return se.invoke(se.callUsers, [ name ]).then(function(res) {
				state.users = res;
				drawUsers();
			});
		}

		function selectHub(name) {
			state.selected = name;
			state.users = null;
			setHash(name);
			drawUsers();
			return loadUsers(name);
		}

		function addHub() {
			var name = (hubNameInput.value || '').trim();
			var pass = hubPassInput.value || '';
			if (!validName(name)) {
				ui.addNotification(null, E('p', {}, _('HUB names may contain A-Z, a-z, 0-9, _ . - and be at most 32 characters')), 'warning');
				return;
			}
			return se.run(se.callHubAdd, [ name, pass ]).then(function(res) {
				if (res && res.ok) {
					hubNameInput.value = '';
					hubPassInput.value = '';
					return refresh().then(function() { return selectHub(name); });
				}
			});
		}

		function deleteHub(name) {
			if (!confirm(_('Delete HUB "%s" and all of its users?').format(name)))
				return;
			return se.run(se.callHubDelete, [ name ]).then(function(res) {
				if (res && res.ok) {
					if (state.selected === name) {
						state.selected = null;
						state.users = null;
						setHash(null);
					}
					return refresh();
				}
			});
		}

		function securenat(name, enable) {
			return se.run(se.callHubSecurenat, [ name, String(enable) ]);
		}

		function addUser(nameInput, passInput, authInput, noteInput) {
			var name = (nameInput.value || '').trim();
			var pass = passInput.value || '';
			var auth = authInput.value;
			var note = noteInput.value || '';

			if (!validName(name)) {
				ui.addNotification(null, E('p', {}, _('User names may contain A-Z, a-z, 0-9, _ . - and be at most 32 characters')), 'warning');
				return;
			}
			if (auth === 'password' && !pass) {
				ui.addNotification(null, E('p', {}, _('A password is required for password authentication')), 'warning');
				return;
			}

			return se.run(se.callUserAdd, [ state.selected, name, pass, auth, note ]).then(function(res) {
				if (res && res.ok) {
					nameInput.value = '';
					passInput.value = '';
					noteInput.value = '';
					return refresh();
				}
			});
		}

		function deleteUser(name) {
			if (!confirm(_('Delete user "%s"?').format(name)))
				return;
			return se.run(se.callUserDelete, [ state.selected, name ]).then(function(res) {
				if (res && res.ok)
					return refresh();
			});
		}

		function showUserPassword(name) {
			var input = E('input', {
				'type': 'password',
				'class': 'cbi-input-text',
				'style': 'width:100%',
				'placeholder': _('New password')
			});

			ui.showModal(_('Set password for %s').format(name), [
				E('p', {}, _('This changes the VPN user password on the server.')),
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
							return se.run(se.callUserPassword, [ state.selected, name, input.value ]).then(function(res) {
								if (res && res.ok)
									ui.hideModal();
							});
						}
					}, _('Save'))
				])
			]);
		}

		var container = E('div', {}, [
			E('h2', {}, _('Virtual HUBs')),

			E('div', { 'class': 'cbi-section' }, [
				E('h3', {}, _('Create a HUB')),
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						hubNameInput, ' ', hubPassInput, ' ', addHubBtn
					])
				])
			]),

			E('div', { 'class': 'cbi-section' }, [
				hubTableBox
			]),

			E('div', { 'class': 'cbi-section' }, [
				usersBox
			])
		]);

		if (initial && initial.ok) {
			state.hubs = initial.hubs || [];
		} else {
			state.error = initial && initial.error ? initial.error : _('Cannot read virtual HUBs');
		}
		drawHubs();

		var wanted = hashHub();
		if (wanted && state.hubs.some(function(h) { return h.name === wanted; }))
			selectHub(wanted);
		else
			drawUsers();

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
