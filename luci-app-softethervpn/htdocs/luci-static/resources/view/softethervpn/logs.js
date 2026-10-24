'use strict';
'require view';
'require poll';
'require ui';
'require view.softethervpn.common as se';

return view.extend({
	load: function() {
		return se.invoke(se.callLogs, [ '400' ]);
	},

	render: function(initial) {
		var pre = E('pre', {
			'id': 'softethervpn-log',
			'style': 'width:100%;height:60vh;overflow:auto;background:#111;color:#ddd;' +
				'padding:0.75em;font-size:12px;line-height:1.4;white-space:pre;' +
				'border-radius:4px;box-sizing:border-box'
		});
		var pathText = E('span');

		function stripAnsi(text) {
			return String(text || '').replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');
		}

		function setText(text) {
			var atBottom = pre.scrollTop + pre.clientHeight >= pre.scrollHeight - 40;
			pre.textContent = stripAnsi(text);
			if (atBottom)
				pre.scrollTop = pre.scrollHeight;
		}

		function apply(res) {
			if (!res || !res.ok) {
				pathText.textContent = '—';
				setText(res && res.error ? res.error : _('Cannot read logs'));
				return;
			}
			pathText.textContent = res.path || '—';
			setText(res.text || _('No log entries found.'));
		}

		function refresh() {
			return se.invoke(se.callLogs, [ '400' ]).then(apply);
		}

		var container = E('div', {}, [
			E('h2', {}, _('Server log')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'cbi-value' }, [
					E('div', { 'class': 'cbi-value-field' }, [
						E('button', {
							'class': 'btn cbi-button cbi-button-action',
							'click': refresh
						}, _('Refresh')),
						' ',
						E('button', {
							'class': 'btn cbi-button cbi-button-remove',
							'click': function() {
								if (!confirm(_('Clear the current log file?')))
									return;
								return se.run(se.callLogClear).then(refresh);
							}
						}, _('Clear')),
						' ',
						E('span', { 'class': 'cbi-section-descr' }, [
							_('File:'), ' ', pathText,
							' — ',
							_('auto-refresh every 5 seconds')
						])
					])
				]),
				pre
			])
		]);

		apply(initial);

		poll.add(function() {
			return se.invoke(se.callLogs, [ '400' ]).then(apply);
		}, 5);

		return container;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
