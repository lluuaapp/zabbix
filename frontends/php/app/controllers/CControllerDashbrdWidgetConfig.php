<?php
/*
** Zabbix
** Copyright (C) 2001-2017 Zabbix SIA
**
** This program is free software; you can redistribute it and/or modify
** it under the terms of the GNU General Public License as published by
** the Free Software Foundation; either version 2 of the License, or
** (at your option) any later version.
**
** This program is distributed in the hope that it will be useful,
** but WITHOUT ANY WARRANTY; without even the implied warranty of
** MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
** GNU General Public License for more details.
**
** You should have received a copy of the GNU General Public License
** along with this program; if not, write to the Free Software
** Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
**/


class CControllerDashbrdWidgetConfig extends CController {

	protected function checkInput() {
		$fields = [
			'widgetid' =>	'db widget.widgetid',
			'fields' =>		'array'
		];

		$ret = $this->validateInput($fields);

		if ($ret) {
			/*
			 * @var string fields['type']
			 * @var string fields[<name>]  (optional)
			 */
			if ($this->hasInput('fields')) {
				$widget_fields = $this->getInput('fields');
				$known_widget_types = array_keys(CWidgetConfig::getKnownWidgetTypes());

				if (!array_key_exists('type', $widget_fields)) {
					error(_s('Invalid parameter "%1$s": %2$s.', 'fields',
						_s('the parameter "%1$s" is missing', 'type')
					));
					$ret = false;
				}
				elseif (!in_array($widget_fields['type'], $known_widget_types)) {
					error(_s('Invalid parameter "%1$s": %2$s.', 'fields[type]',
						_s('value must be one of %1$s', implode(',', $known_widget_types))
					));
					$ret = false;
				}
			}
		}

		if (!$ret) {
			// TODO VM: prepare propper response for case of incorrect fields
			$this->setResponse(new CControllerResponseData(['body' => CJs::encodeJson('')]));
		}

		return $ret;
	}

	protected function checkPermissions() {
		return ($this->getUserType() >= USER_TYPE_ZABBIX_USER);
	}

	protected function doAction() {
		$widget = [];
		$dialogue = [];

		// default fields data
		$fields = [
			'type' => WIDGET_CLOCK
		];

		// Get fields from dialogue form
		$dialogue_fields = $this->hasInput('fields') ? $this->getInput('fields') : [];

		// Take default values, replce with saved ones, replace with selected in dialogue
		$fields_data = array_merge($fields, $widget, $dialogue_fields);
		$dialogue['form'] = CWidgetConfig::getForm($fields_data);
		$this->setResponse(new CControllerResponseData([
			'user' => [
				'debug_mode' => $this->getDebugMode()
			],
			'dialogue' => $dialogue,
			'captions' => $this->getCaptions($dialogue['form'])
		]));
	}

	/**
	 * Prepares mapped list of names for all required resources
	 *
	 * @param CWidgetForm $form
	 *
	 * @return array
	 */
	private function getCaptions($form) {
		$captions = [];
		foreach ($form->getFields() as $field) {
			if ($field instanceof CWidgetFieldItem) {
				if (!array_key_exists('items', $captions)) {
					$captions['items'] = [];
				}
				if (bccomp($field->getValue(true), '0') === 1
					&& !array_key_exists($field->getValue(true), $captions['items'])
				){
					$captions['items'][$field->getValue(true)] = '';
				}
			}
		}

		foreach ($captions as $resource => $list) {
			if (empty($list)) {
				continue;
			}
			if ($resource === 'items') {
				$items = API::Item()->get([
					'output' => ['itemid', 'hostid', 'key_', 'name'],
					'selectHosts' => ['name'],
					'itemids' => array_keys($list),
					'webitems' => true
				]);

				if ($items) {
					$items = CMacrosResolverHelper::resolveItemNames($items);

					foreach ($items as $key => $item) {
						$captions['items'][$item['itemid']] = $item['hosts'][0]['name'].NAME_DELIMITER.$item['name_expanded'];
					}
				}
			}
		}

		return $captions;
	}
}
