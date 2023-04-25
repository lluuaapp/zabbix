/*
** Zabbix
** Copyright (C) 2001-2023 Zabbix SIA
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

const SVGNS = 'http://www.w3.org/2000/svg';
const XMLNS = 'http://www.w3.org/1999/xhtml';
const FONT_SIZE_RATIO = 0.82;


// Must be synced with PHP.
const DESC_V_POSITION_TOP = 0
const DESC_V_POSITION_BOTTOM = 1;

const UNITS_POSITION_BEFORE = 0;
const UNITS_POSITION_ABOVE = 1;
const UNITS_POSITION_AFTER = 2;
const UNITS_POSITION_BELOW = 3;

// If min/max block widths exceed this (current 1/4) of total SVG width, then limit the width of min/max blocks.
const MAX_WIDTH_MINMAX_RATIO = 0.25;

class CSVGGauge {
	// TO DO: add description?
	constructor(options, data) {
		this.options = options;
		this.container = options.container;
		this.data = data;

		this.angleConfigOld = this.data.angle;
		this.angleConfigNew = this.data.angle;

		this.valueOld = this.data.minmax.min.raw;
		this.valueNew = this.data.value.raw;

		this.minMaxShowOld = this.data.minmax.show;
		this.minMaxShowNew = this.data.minmax.show;

		this.minOld = this.data.minmax.min.raw;
		this.minNew = this.data.minmax.min.raw;

		this.maxOld = this.data.minmax.max.raw;
		this.maxNew = this.data.minmax.max.raw;

		this.angleStart = this.data.angle === 180 ? -90 : -135;
		this.angleEnd = this.data.angle === 180 ? 90 : 135;

		this.angleOld = this.angleStart;
		this.angleNew = this.#getAngle(this.valueNew, this.minNew, this.maxNew);

		this.initialLoad = true;

		// Width and height of the SVG.
		this.width = this.options.canvas.width;
		this.height = this.options.canvas.height;

		// Contains all the elements - description, value, min/max, thresholds ...
		this.elements = {};

		// Create the main SVG element.
		this.svg = document.createElementNS(SVGNS, 'svg');

		// TO DO: the preserveAspectRatio: 'xMidYMid' doesn't seem to do anything. At least for now. So probably delete this comment later.
		this.#addAttributesNS(this.svg, {width: this.width, height: this.height});
		this.#addAttributes(this.svg, {xmlns: SVGNS});

		// Set starting point - center coordinates of arc.
		this.x = this.width / 2;
		this.y = this.height / 2;

		this.radius = 0;
		this.thickness = 50;

		// TO DO: Background color set to parent DIV. But let's leave this in for now to test if saving image will work.
		// if (this.options.bg_color !== '') {
		// 	this.#addAttributesNS(this.svg, {style: `background-color: ${this.options.bg_color}`});
		// }

		// Add all objects to DOM.
		this.#draw();

		this.initialLoad = false;

		this.#addDebugGrid(25,5);
	}

	update(data) {
		this.data = data;

		this.valueOld = this.valueNew;
		this.valueNew = this.data.value.raw;

		this.minMaxShowOld = this.minMaxShowNew;
		this.minMaxShowNew = this.data.minmax.show;

		this.minOld = this.minNew;
		this.minNew = this.data.minmax.min.raw;

		this.maxOld = this.maxNew;
		this.maxNew = this.data.minmax.max.raw;

		this.angleConfigOld = this.angleConfigNew;
		this.angleConfigNew = this.data.angle;

		this.angleStart = this.data.angle === 180 ? -90 : -135;
		this.angleEnd = this.data.angle === 180 ? 90 : 135;

		if (this.angleConfigOld === this.angleConfigNew) {
			this.angleOld = this.#getAngle(this.valueOld, this.minOld, this.maxOld);
		}
		else {
			this.angleOld = this.angleStart;
		}

		this.angleNew = this.#getAngle(this.valueNew, this.minNew, this.maxNew);

		this.#draw();
	}

	// TO DO: add description and finish function
	#draw() {
		if (this.initialLoad) {
			// Add SVG to DOM.
			this.container.appendChild(this.svg);

			this.#addDescription(this.data.description);

			if (this.data.description.pos === DESC_V_POSITION_TOP) {
				this.#reposition(this.elements.description, this.x, 0, 'top center');
				this.#show(this.elements.description);
			}

			// TO DO: add other objects and fix all the positions.

			/*
			* First add invisible element to calculate min and max dimensions. The height will also affect thresholds.
			* Since there is no separate setting for threshold label size, we will use this as threshold label height.
			*/
			// this.#addMinMax({min: this.data.minmax.min, max: this.data.minmax.max}, this.data.minmax.font_size);

			if (this.data.value.show_arc) {
				this.#addValueArc();
			}

			// Threshold arc can only be drawn if there are thresholds.
			if (this.data.thresholds.data.length) {
				// Reserve space for threshold labels on top if they should be displayed.
				if (this.data.thresholds.show_labels) {
					// this.y += this.elements.min.height;
				}

				// Reserve space for min label or some threshold label. Which shouldn't exceed the min width.

				// TO DO: Check what happens if it is value-mapped and is thresholds exceed the limit of min/max width.
				// this.x = this.data.minmax.show ? this.x = this.elements.min.width : 0;

				if (this.data.thresholds.show_arc) {
					this.#addThresholdArc();
				}
			}

			// Min/Max max position depends on arc radiuses as well as how wide the min/max blocks are.
			// TODO: if there is no value arc and no threshold arc, the position of min and max is aligned to center of SVG.

			/*
			* Can use any height or width. Min and max they are both the same in terms of dimensions. Though they each have
			* though they each have different coordinates.
			*/

			this.#addValue(this.data.value, this.data.units);
			this.#reposition(this.elements.value, this.width / 2, this.y, 'bottom center');
			this.#show(this.elements.value);

			if (this.data.description.pos === DESC_V_POSITION_BOTTOM) {
				// Same anchor, but this.y will be different as it depends on other objects.
				this.#reposition(this.elements.description, this.x, this.y, 'top center');
				this.#show(this.elements.description);
			}

			if (this.data.minmax.show) {
				this.#addMinMax();

				let minX = 0;
				let maxX = 0;
				let minY = 0;
				let maxY = 0;

				if (!this.data.thresholds.show_arc) {
					minX = this.elements.valueArcContainer.coordinates.x1 - 3 * FONT_SIZE_RATIO;
					maxX = this.elements.valueArcContainer.coordinates.x2 + 3 * FONT_SIZE_RATIO;
					minY = this.elements.valueArcContainer.coordinates.y4;
					maxY = this.elements.valueArcContainer.coordinates.y4;
				}
				else {
					minX = this.elements.thresholdArcContainer.coordinates.x1 - 3 * FONT_SIZE_RATIO;
					maxX = this.elements.thresholdArcContainer.coordinates.x2 + 3 * FONT_SIZE_RATIO;
					minY = this.elements.thresholdArcContainer.coordinates.y4;
					maxY = this.elements.thresholdArcContainer.coordinates.y4;
				}

				this.#reposition(this.elements.min, minX, minY, 'bottom right');
				this.#show(this.elements.min);

				this.#reposition(this.elements.max, maxX, maxY, 'bottom left');
				this.#show(this.elements.max);
			}
		}
		else {
			this.#addDescription(this.data.description);

			if (this.data.description.pos === DESC_V_POSITION_TOP) {
				this.#reposition(this.elements.description, this.x, 0, 'top center');
				this.#show(this.elements.description);
			}

			if (this.data.value.show_arc) {
				this.#addValueArc();
			}

			if (this.data.thresholds.data.length) {
				// Reserve space for min label or some threshold label. Which shouldn't exceed the min width.

				// TO DO: Check what happens if it is value-mapped and is thresholds exceed the limit of min/max width.
				// this.x = this.data.minmax.show ? this.x = this.elements.min.width : 0;

				if (this.data.thresholds.show_arc) {
					this.#addThresholdArc();
				}
			}

			this.#addValue(this.data.value, this.data.units);
			this.#reposition(this.elements.value, this.width / 2, this.y, 'bottom center');

			if (this.data.description.pos === DESC_V_POSITION_BOTTOM) {
				// Same anchor, but this.y will be different as it depends on other objects.
				this.#reposition(this.elements.description, this.x, this.y, 'top center');
				this.#show(this.elements.description);
			}

			if (this.data.minmax.show) {
				this.#addMinMax();

				let minX = 0;
				let maxX = 0;
				let minY = 0;
				let maxY = 0;

				if (!this.data.thresholds.show_arc) {
					minX = this.elements.valueArcContainer.coordinates.x1 - 3 * FONT_SIZE_RATIO;
					maxX = this.elements.valueArcContainer.coordinates.x2 + 3 * FONT_SIZE_RATIO;
					minY = this.elements.valueArcContainer.coordinates.y4;
					maxY = this.elements.valueArcContainer.coordinates.y4;
				}
				else {
					minX = this.elements.thresholdArcContainer.coordinates.x1 - 3 * FONT_SIZE_RATIO;
					maxX = this.elements.thresholdArcContainer.coordinates.x2 + 3 * FONT_SIZE_RATIO;
					minY = this.elements.thresholdArcContainer.coordinates.y4;
					maxY = this.elements.thresholdArcContainer.coordinates.y4;
				}

				this.#reposition(this.elements.min, minX, minY, 'bottom right');
				this.#reposition(this.elements.max, maxX, maxY, 'bottom left');
				this.#show(this.elements.min);
				this.#show(this.elements.max);
			}
		}
	}

	// TO DO: add description
	#addDescription(description) {
		const line_height = this.height * description.font_size / 100;
		const font_size = line_height * FONT_SIZE_RATIO;

		let foreign_object = null;
		let div = null;

		if (this.initialLoad) {
			foreign_object = document.createElementNS(SVGNS, 'foreignObject');
			div = document.createElement('div');

			this.#addAttributesNS(foreign_object, {x: 0, y: 0, width: '100%', height: '100%', visibility: 'hidden', id: 'description-container'});
			this.#addAttributes(div, {xmlns: XMLNS, style: `display: inline-flex; font-size: ${font_size}px;`, id: 'description-container-div'});

			foreign_object.appendChild(div);
			this.svg.appendChild(foreign_object);
		}
		else {
			foreign_object = this.svg.querySelector('#description-container');
			div = this.svg.querySelector('#description-container-div');

			div.innerHTML = '';

			this.#addAttributesNS(foreign_object, {width: '100%', height: '100%'});
		}

		if (description.is_bold) {
			this.#addAttributes(div, {style: 'font-weight: bold;'});
		}

		if (description.color !== '') {
			this.#addAttributes(div, {style: `color: #${description.color};`});
		}

		const lines = description.text.split('\n');

		let line_count;

		for (line_count = 0; line_count < lines.length; line_count++) {
			div.appendChild(document.createTextNode(lines[line_count]));

			if (line_count < lines.length - 1) {
				div.appendChild(document.createElement('br'));
			}
		}

		const block_height = line_height * line_count;
		const height = div.offsetHeight + (block_height - div.offsetHeight);

		let width = div.offsetWidth;

		// In case description is wider, than the actual space of SVG, limit the description and add overflow ellipsis.
		if (width > this.width) {
			this.#addAttributes(div, {style: 'overflow: hidden; text-overflow: ellipsis;'});
			width = this.width;
		}

		this.#addAttributesNS(foreign_object, {height: `${height}px`, width: `${width}px`});
		this.#addAttributes(div, {style: 'height: 100%; width: 100%; display: block;'});

		this.elements.description = {
			parent: foreign_object,
			node: div,
			width: width,
			height: height
		};
	}

	// TO DO: add description
	#addValue(value, units) {
		let foreign_object = null;
		let div = null;

		if (this.initialLoad) {
			foreign_object = document.createElementNS(SVGNS, 'foreignObject');
			div = document.createElement('div');

			this.#addAttributesNS(foreign_object, {x: 0, y: 0, width: '100%', height: '100%', visibility: 'hidden', id: 'value-container'});
			this.#addAttributes(div, {xmlns: XMLNS, style: 'display: inline-flex;', id: 'value-container-div'});

			foreign_object.appendChild(div);
			this.svg.appendChild(foreign_object);
		}
		else {
			foreign_object = this.svg.querySelector('#value-container');
			div = this.svg.querySelector('#value-container-div');
		}

		const value_line_height = this.height * value.font_size / 100;
		const value_font_size = value_line_height * FONT_SIZE_RATIO;

		let block_height = 0;

		// Create two div blocks inside, otherwise add text element to parent.
		if (units.show && units.text !== '') {
			let value_div = null;
			let units_div = null;

			if (this.initialLoad) {
				value_div = document.createElement('div');
				this.#addAttributesNS(value_div, {id: 'value'});

				units_div = document.createElement('div');
				this.#addAttributesNS(units_div, {id: 'units'});
			}
			else {
				value_div = this.svg.querySelector('#value');
				units_div = this.svg.querySelector('#units');

				// Clear contents of containers
				div.innerHTML = '';
				units_div.innerHTML = '';
				value_div.innerHTML = '';
			}

			const units_line_height = this.height * units.font_size / 100;
			const units_font_size = units_line_height * FONT_SIZE_RATIO;

			// Append font size to each element.
			this.#addAttributes(value_div, {xmlns: XMLNS, style: `font-size: ${value_font_size}px;`});
			this.#addAttributes(units_div, {xmlns: XMLNS, style: `font-size: ${units_font_size}px;`});

			if (value.is_bold) {
				this.#addAttributes(value_div, {style: `font-weight: bold;`});
			}
			if (value.color !== '') {
				this.#addAttributes(value_div, {style: `color: #${value.color};`});
			}

			if (units.is_bold) {
				this.#addAttributes(units_div, {style: `font-weight: bold;`});
			}
			if (units.color !== '') {
				this.#addAttributes(units_div, {style: `color: #${units.color};`});
			}

			if (units.pos === UNITS_POSITION_BEFORE) {
				// Take the largest height from both.
				block_height = (units_line_height > value_line_height) ? units_line_height : value_line_height;

				// If units are larger, add space after units. If value is larger add space before value.
				if (units_line_height > value_line_height) {
					units_div.appendChild(document.createTextNode(units.text + '\xa0'));
					value_div.appendChild(document.createTextNode(value.text));
				}
				else {
					units_div.appendChild(document.createTextNode(units.text));
					value_div.appendChild(document.createTextNode('\xa0' + value.text));
				}

				this.#addAttributes(div, {'style': 'align-items: baseline;'});

				div.appendChild(units_div);
				div.appendChild(value_div);
			}
			else if (units.pos === UNITS_POSITION_ABOVE) {
				// Total height is both units and value combined.
				block_height = units_line_height + value_line_height;

				units_div.appendChild(document.createTextNode(units.text));
				value_div.appendChild(document.createTextNode(value.text));

				this.#addAttributes(div, {'style': 'align-items: center; flex-direction: column;'});

				div.appendChild(units_div);
				div.appendChild(value_div);
			}
			else if (units.pos === UNITS_POSITION_AFTER) {
				// Take the largest height from both.
				block_height = (units_line_height > value_line_height) ? units_line_height : value_line_height;

				// If units are larger, add space before units. If value is larger add space after value.
				if (units_line_height > value_line_height) {
					units_div.appendChild(document.createTextNode('\xa0' + units.text));
					value_div.appendChild(document.createTextNode(value.text));
				}
				else {
					units_div.appendChild(document.createTextNode(units.text));
					value_div.appendChild(document.createTextNode(value.text + '\xa0'));
				}

				this.#addAttributes(div, {'style': 'align-items: baseline;'});

				div.appendChild(value_div);
				div.appendChild(units_div);
			}
			else if (units.pos === UNITS_POSITION_BELOW) {
				// Total height is both units and value combined.
				block_height = units_line_height + value_line_height;

				units_div.appendChild(document.createTextNode(units.text));
				value_div.appendChild(document.createTextNode(value.text));

				this.#addAttributes(div, {'style': 'align-items: center; flex-direction: column;'});

				div.appendChild(value_div);
				div.appendChild(units_div);
			}
		}
		else {
			// No units.
			block_height = value_line_height;

			// Append font size to parent.
			this.#addAttributes(div, {style: `font-size: ${value_font_size}px;`});

			if (value.is_bold) {
				this.#addAttributes(div, {style: `font-weight: bold;`});
			}

			if (value.color !== '') {
				this.#addAttributes(div, {style: `color: #${value.color};`});
			}

			div.appendChild(document.createTextNode(value.text));
		}

		const height = div.offsetHeight + (block_height - div.offsetHeight);

		// TODO: check arc radius. Max width is the inner block. Add overflow ellipsis and resize accordingly just like in description.
		const width = div.offsetWidth;

		this.#addAttributesNS(foreign_object, {height: `${height}px`, width: `${width}px`});

		this.elements.value = {
			parent: foreign_object,
			node: div,
			width: width,
			height: height
		};
	}

	// TO DO: add description
	#addMinMax() {
		const minmax = {min: this.data.minmax.min, max: this.data.minmax.max};

		for (const [key, value] of Object.entries(minmax)) {
			const line_height = this.height * this.data.minmax.font_size / 100;
			const font_size = line_height * FONT_SIZE_RATIO;

			let foreign_object = null;
			let div = null;

			if (this.initialLoad || (!this.minMaxShowOld && this.minMaxShowNew)) {
				foreign_object = document.createElementNS(SVGNS, 'foreignObject');
				div = document.createElement('div');

				this.#addAttributesNS(foreign_object, {x: 0, y: 0, width: '100%', height: '100%', visibility: 'hidden', id: `${key}-container`});
				this.#addAttributes(div, {xmlns: XMLNS, style: 'display: inline-flex; width: fit-content; height: fit-content;', id: `${key}-container-div`});

				foreign_object.appendChild(div);
				this.svg.appendChild(foreign_object);
			}
			else {
				foreign_object = this.svg.querySelector(`#${key}-container`);
				div = this.svg.querySelector(`#${key}-container-div`);
				div.innerHTML = '';

				this.#addAttributesNS(foreign_object, {height: '100%', width: '100%'});
			}

			this.#addAttributes(div, {style: `font-size: ${font_size}px;`});

			if (key === 'min') {
				this.#addAttributes(foreign_object, {style: 'text-align: right;'});
			}
			else {
				this.#addAttributes(foreign_object, {style: 'text-align: left;'});
			}

			// This text already contains units inside, because they are always after the min or max.
			div.appendChild(document.createTextNode(value.text));

			const height = div.offsetHeight + (line_height - div.offsetHeight);
			const width = div.offsetWidth;

			this.#addAttributesNS(foreign_object, {height: `${height}px`, width: `${width}px`});

			this.elements[key] = {
				parent: foreign_object,
				node: div,
				width: width,
				height: height
			};
		}

		// Make both elements same width depending on which one of them is wider than then other.
		if (this.elements.min.width > this.elements.max.width) {
			this.elements.max.width = this.elements.min.width;
		}
		else {
			this.elements.min.width = this.elements.max.width;
		}

		// Both min and max are equal here, so doesn't matter which is compared. Both have to be shurnk down.
		const max_width = this.width * MAX_WIDTH_MINMAX_RATIO;

		if (this.elements.max.width > max_width) {
			this.elements.max.width = max_width;
			this.#addAttributes(this.elements.max.node, {style: 'overflow: hidden; text-overflow: ellipsis;'});

			this.elements.min.width = max_width;
			this.#addAttributes(this.elements.min.node, {style: 'overflow: hidden; text-overflow: ellipsis;'});
		}

		for (const key of Object.keys(minmax)) {
			this.#addAttributesNS(this.elements[key].parent, {
				height: `${this.elements[key].height}px`,
				width: `${this.elements[key].width}px`
			});
		}
	}

	#polarToCartesian(centerX, centerY, radius, angleInDegrees) {
		const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;

		return {
			x: centerX + (radius * Math.cos(angleInRadians)),
			y: centerY + (radius * Math.sin(angleInRadians))
		};
	}

	#defineArc(x, y, radius, startAngle, endAngle, thickness){
		const innerStart = this.#polarToCartesian(x, y, radius, endAngle);
		const innerEnd = this.#polarToCartesian(x, y, radius, startAngle);
		const outerStart = this.#polarToCartesian(x, y, radius + thickness, endAngle);
		const outerEnd = this.#polarToCartesian(x, y, radius + thickness, startAngle);

		const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

		return [
			'M', outerStart.x, outerStart.y,
			'A', radius + thickness, radius + thickness, 0, largeArcFlag, 0, outerEnd.x, outerEnd.y,
			'L', innerEnd.x, innerEnd.y,
			'A', radius, radius, 0, largeArcFlag, 1, innerStart.x, innerStart.y,
			'L', outerStart.x, outerStart.y, 'Z'
		].join(' ');
	}

	#addArcEmpty(container) {
		let path = this.svg.querySelector('#arc-empty');

		if (this.initialLoad || !path) {
			path = document.createElementNS(SVGNS, 'path');

			this.#addAttributesNS(path, {id: 'arc-empty', class: 'arc empty'});

			container.appendChild(path);
		}

		const pathDefinition = this.#defineArc(this.x, this.y, this.radius, this.angleStart, this.angleEnd, this.thickness);

		this.#addAttributesNS(path, {d: pathDefinition});
	}

	#getAngle(value, min, max) {
		const tempMin = 0;
		const tempMax = max - min;
		const tempValue = value - min;

		let angle = 0;

		if (value < min) {
			angle = this.angleStart;
		}
		else if (value > max) {
			angle = this.angleEnd;
		}
		else {
			if (this.data.angle === 180) {
				angle = ((tempValue * 180) / (tempMax + tempMin)) - 90;
			}
			else {
				angle = ((tempValue * 270) / (tempMax + tempMin)) - 135;
			}
		}

		return angle;
	}

	#animate(angle) {
		let currentAngle = angle;

		// A step to move in arc in angles
		const step = 1;

		if (this.angleOld < this.angleNew) {
			const angleNext = currentAngle + step;
			if (angleNext <= this.angleNew) {
				currentAngle = angleNext;
			}
			else {
				currentAngle += this.angleNew - currentAngle;
			}
		}
		else {
			const angleNext = currentAngle - step;
			if (angleNext >= this.angleNew) {
				currentAngle = angleNext;
			}
			else {
				currentAngle -= currentAngle - this.angleNew;
			}
		}

		const path = this.svg.querySelector('#arc-value');

		const pathDefinition = this.#defineArc(this.x, this.y, this.radius, this.angleStart, currentAngle, this.thickness);
		this.#addAttributesNS(path, {d: pathDefinition});

		if (currentAngle !== this.angleNew) {
			window.requestAnimationFrame(() => {
				this.#animate(currentAngle)
			});
		}
	}

	#addArcValue() {
		if (this.initialLoad) {
			const path = document.createElementNS(SVGNS, 'path');

			this.#addAttributesNS(path, {id: 'arc-value', class: 'arc value'});

			this.elements.valueArcContainer.node.appendChild(path);
		}

		window.requestAnimationFrame(() => {
			this.#animate(this.angleOld)
		});
	}

	// TO DO: finish the function
	#addValueArc() {
		// Available max radius depends on which ever side is smaller while also taking min/max block widths into account.
		// But if we have two arcs then value arc is inside the threshold arc, which make the available space even smaller.

		let valueArcContainer = this.svg.querySelector('#value-arc-container');

		if (this.initialLoad || !valueArcContainer) {
			valueArcContainer = document.createElementNS(SVGNS, 'g');

			this.#addAttributesNS(valueArcContainer, {id: 'value-arc-container'});

			this.svg.appendChild(valueArcContainer);

			this.elements.valueArcContainer = {
				node: valueArcContainer
			};
		}

		this.radius = this.height - this.elements.description.height - this.thickness;

		if (this.data.description.pos === DESC_V_POSITION_TOP) {
			this.y = this.height;
		}
		else if (this.data.description.pos === DESC_V_POSITION_BOTTOM) {
			this.y = this.height - this.elements.description.height;
		}

		this.#addArcEmpty(this.elements.valueArcContainer.node);
		this.#addArcValue();

		const rect = valueArcContainer.getBoundingClientRect();

		this.elements.valueArcContainer.width = rect.width;
		this.elements.valueArcContainer.height = rect.height;

		this.elements.valueArcContainer.coordinates = this.#calcCoordinates(this.x - rect.width / 2, this.y - rect.height, rect.width, rect.height);
	}

	// TO DO: finish the function and write a description. First parameter is for colors, not labels.
	#addThresholdArc() {
		// Available max radius depends on which ever side is smaller while also taking min/max block widths into account.
		// Threshold arc thickness depends on whether there is a value arc or it is independent.
		// Threshold arc is always on the outer rim.

		// If the thickness would be 1 it would be simply a thin line. But when thickness is added, it extends in both directions.
		// outer is -offset and inner is +offset;
		// Find the outer rim starting point depending on angle.
		// If there is no threshold for min, take the color of the user theme.

		this.thresholdsArcParts = [];

		for (let i = 0; i < this.data.thresholds.data.length; i++) {
			let valueEnd = 0;

			if (i < this.data.thresholds.data.length - 1) {
				valueEnd = this.data.thresholds.data[i + 1].threshold_value;
			}
			else {
				valueEnd = this.data.minmax.max.raw;
			}

			this.thresholdsArcParts[i] = {
				angleStart: this.#getAngle(this.data.thresholds.data[i].threshold_value, this.data.minmax.min.raw, this.data.minmax.max.raw),
				angleEnd: this.#getAngle(valueEnd, this.data.minmax.min.raw, this.data.minmax.max.raw),
				label: this.data.thresholds.data[i].text
			};
		}

		let thresholdArcContainer = null;

		if (this.initialLoad) {
			thresholdArcContainer = document.createElementNS(SVGNS, 'g');

			this.#addAttributesNS(thresholdArcContainer, {id: 'threshold-arc-container'});

			this.svg.appendChild(thresholdArcContainer);
		}
		else {
			thresholdArcContainer = this.svg.querySelector('#threshold-arc-container');
		}

		this.elements.thresholdArcContainer = {
			node: thresholdArcContainer
		};


		this.radius = this.height - this.elements.description.height - this.thickness;

		if (this.data.description.pos === DESC_V_POSITION_TOP) {
			this.y = this.height;
		}
		else if (this.data.description.pos === DESC_V_POSITION_BOTTOM) {
			this.y = this.height - this.elements.description.height;
		}


		// Reserve space for threshold labels on top if they should be displayed.
		if (this.data.thresholds.show_labels) {
			// this.y += this.elements.min.height;
		}


		this.#addArcEmpty(this.elements.thresholdArcContainer.node);

		const rect = thresholdArcContainer.getBoundingClientRect();

		this.elements.thresholdArcContainer.width = rect.width;
		this.elements.thresholdArcContainer.height = rect.height;

		this.elements.thresholdArcContainer.coordinates = this.#calcCoordinates(this.x - rect.width / 2, this.y - rect.height, rect.width, rect.height);


		if (!this.initialLoad) {
			const parts = this.svg.querySelectorAll('.arc-threshold-part');

			for (let i = 0; i < parts.length; i++) {
				parts[i].remove();
			}
		}


		for (let i = 0; i < this.thresholdsArcParts.length; i++) {
			const path = document.createElementNS(SVGNS, 'path');

			this.#addAttributesNS(path, {class: 'arc-threshold-part'});

			this.elements.thresholdArcContainer.node.appendChild(path);

			const pathDefinition = this.#defineArc(this.x, this.y, this.radius, this.thresholdsArcParts[i].angleStart, this.thresholdsArcParts[i].angleEnd, this.thickness);

			this.#addAttributesNS(path, {d: pathDefinition, style: `fill: #${this.data.thresholds.data[i].color}`});
		}


		if (this.data.thresholds.show_labels) {
			this.#addThresholdsLabels();
		}
		else {
			if (this.elements.thresholdsLabelsContainer) {
				this.elements.thresholdsLabelsContainer.node.innerHTML = '';
			}
		}
	}

	#addThresholdsLabels() {
		// Depends on whether there is at least one arc. They can be displayed on value arc as well without problems.
		// Though it doesn't make a lot of sense to do so. But there has to be a threshold to show the label.
		// If we don't have value arc or threshold arc we can't show labels, even if thresholds are defined.

		// Threshold font size share same height as min/max since there is no separate setting for it.
		// So we need to reserve space on top of the outter arc. Which ever it is.

		// Each threshold x and y also depends on which ever arc is displayed on the outter rim.
		// Anchor for each threshold depends on the quadrant in which the circle is drawn.

		// First thing to do is probably translate the values to coordinates.

		// If the area on which threshold should be displayed is taken by another threshold or min/max, it cannot be displayed.

		// To ensure most threholds are displayed, I... I don't know what to do.

		let thresholdsLabelsContainer = this.svg.querySelector('#thresholds-labels-container');

		if (this.initialLoad || !thresholdsLabelsContainer) {
			thresholdsLabelsContainer = document.createElementNS(SVGNS, 'g');

			this.#addAttributesNS(thresholdsLabelsContainer, {id: 'thresholds-labels-container'});

			this.svg.appendChild(thresholdsLabelsContainer);

			this.elements.thresholdsLabelsContainer = {
				node: thresholdsLabelsContainer,
				children: []
			};
		}

		thresholdsLabelsContainer.innerHTML = '';

		this.#drawThresholdsLabels();
	}

	#drawThresholdsLabels() {
		for (let i = 0; i < this.thresholdsArcParts.length; i++) {
			// Don't draw label if it is the same as min or max
			if (this.thresholdsArcParts[i].angleStart === this.angleStart || this.thresholdsArcParts[i].angleStart === this.angleEnd) {
				continue;
			}

			let foreign_object = document.createElementNS(SVGNS, 'foreignObject');
			let div = document.createElement('div');

			const line_height = this.height * this.data.minmax.font_size / 100;
			const font_size = line_height * FONT_SIZE_RATIO;

			this.#addAttributesNS(foreign_object, {x: 0, y: 0, width: '100%', height: '100%', visibility: 'hidden'});
			this.#addAttributes(div, {xmlns: XMLNS, style: `display: inline-flex; width: fit-content; height: fit-content; font-size: ${font_size}px;`});

			div.appendChild(document.createTextNode(this.thresholdsArcParts[i].label));
			foreign_object.appendChild(div);
			this.elements.thresholdsLabelsContainer.node.appendChild(foreign_object);

			const height = div.offsetHeight;
			const width = div.offsetWidth;

			this.#addAttributesNS(foreign_object, {height: `${height}px`, width: `${width}px`});

			this.elements.thresholdsLabelsContainer.children[i] = {
				parent: foreign_object,
				node: div,
				width: width,
				height: height
			}

			this.#positionThresholdsLabels(i);
		}
	}

	#positionThresholdsLabels(i) {
		const angle = this.thresholdsArcParts[i].angleStart;

		const radians = ((angle - 90) * Math.PI) / 180;

		const x = (this.x + Math.cos(radians) * (this.radius + this.thickness));
		const y = (this.y + Math.sin(radians) * (this.radius + this.thickness));

		const anchor = angle < 0 ? 'bottom right' : 'bottom left';

		this.#reposition(this.elements.thresholdsLabelsContainer.children[i], x, y, anchor);
		this.#show(this.elements.thresholdsLabelsContainer.children[i]);
	}

	// TO DO: finish the function
	#addNeedle() {
		// Depends on whether there is at least one arc. If both arcs exist, needle takes radius of the smallest arc.
	}

	#addThresholdLabels(arc, thresholds) {
		// Depends on whether there is at least one arc. They can be displayed on value arc as well without problems.
		// Though it doesn't make a lot of sense to do so. But there has to be a threshold to show the label.
		// If we don't have value arc or threshold arc we can't show labels, even if thresholds are defined.

		// Threshold font size share same height as min/max since there is no separate setting for it.
		// So we need to reserve space on top of the outter arc. Which ever it is.

		// Each threshold x and y also depends on which ever arc is displayed on the outter rim.
		// Anchor for each threshold depends on the quadrant in which the circle is drawn.

		// First thing to do is probably translate the values to coordinates.

		// If the area on which threshold should be displayed is taken by another threshold or min/max, it cannot be displayed.

		// To ensure most threholds are displayed, I... I don't know what to do.
	}

	// TO DO: create functions to add arcs, add needle etc.

	// TO DO: add description and finish writing the function.
	resize(width, height) {
		// Set main SVG size again.
		this.width = width;
		this.height = height;
		this.#addAttributesNS(this.svg, {width: width, height: height});

		// TO DO: rezise all other elements and calculate coordinates.
	}

	#reposition(element, x_start, y_start, anchor) {
		const [x, y] = this.#calcXY(x_start, y_start, element.width, element.height, anchor);

		this.#addAttributesNS(element.parent, {x: `${x}px`, y: `${y}px`});

		element.x = x;
		element.y = y;
		element.coordinates = this.#calcCoordinates(x, y, element.width, element.height);
	}

	#show(element) {
		// TO DO: since this is always going to be the container as foreignObject or some other element and not HTML
		// we can remove the removeAttributesNS function.
		// this.#removeAttributesNS(element.parent, {'visibility': {}});
		element.parent.removeAttributeNS(null, 'visibility');
	}

	// TO DO: add description
	#calcXY(x_start, y_start, width, height, anchor) {
		const achor_parts = anchor.split(' ');

		let x;
		let y;

		if (achor_parts.includes('top')) {
			y = y_start;
		}
		else if (achor_parts.includes('middle')) {
			y = y_start - height / 2;
		}
		else if (achor_parts.includes('bottom')) {
			y = y_start - height;
		}

		if (achor_parts.includes('left')) {
			x = x_start;
		}
		else if (achor_parts.includes('center')) {
			x = x_start - width / 2;
		}
		else if (achor_parts.includes('right')) {
			x = x_start - width;
		}

		return [x, y];
	}

	// TO DO: add description
	#calcCoordinates(x, y, width, height) {
		let coordinates = {};

		coordinates.y1 = y;
		coordinates.x1 = x;

		coordinates.x2 = coordinates.x1 + width;
		coordinates.y2 = coordinates.y1;

		coordinates.x3 = coordinates.x1;
		coordinates.y3 = coordinates.y1 + height;

		coordinates.x4 = coordinates.x3 + width;
		coordinates.y4 = coordinates.y3;

		return coordinates;
	}

	// TO DO: add description
	#addAttributesNS(element, attributes) {
		return this.#addAttributes(element, attributes, true);
	}

	// TO DO: add description
	#addAttributes(element, attributes, use_ns = false) {
		for (const key in attributes) {
			if (key === 'style') {
				const style_attr = use_ns ? element.getAttributeNS(null, 'style') : element.getAttribute('style');
				const new_style = attributes[key];
				const styles = {};

				if (style_attr) {
					const style_list = style_attr.split(';').map(s => s.trim());

					style_list.forEach(style => {
						if (style) {
							const [prop, val] = style.split(':').map(s => s.trim());

							styles[prop] = val;
						}
					});
				}

				new_style.split(';').forEach(style => {
					if (style) {
						const [prop, val] = style.split(':').map(s => s.trim());

						styles[prop] = val;
					}
				});

				let style_string = '';

				for (const prop in styles) {
					style_string += prop + ': ' + styles[prop] + '; ';
				}

				if (use_ns) {
					element.setAttributeNS(null, key, style_string.trim());
				}
				else {
					element.setAttribute(key, style_string.trim());
				}
			}
			else {
				if (use_ns) {
					element.setAttributeNS(null, key, attributes[key]);
				}
				else {
					element.setAttribute(key, attributes[key]);
				}
			}
		}
	}

	// TO DO: add description
	#removeAttributesNS(element, attributes) {
		return this.#removeAttributes(element, attributes, true);
	}

	// TO DO: add description
	#removeAttributes(element, attributes, use_ns = false) {
		for (const key in attributes) {
			if (key === 'style') {
				const style_attr = use_ns ? element.getAttributeNS(null, 'style') : element.getAttribute('style');
				const styles = {};

				if (style_attr) {
					const style_list = style_attr.split(';').map(s => s.trim());

					style_list.forEach(style => {
						if (style) {
							const [prop, val] = style.split(':').map(s => s.trim());

							styles[prop] = val;
						}
					});
				}

				const style_to_remove = attributes[key];

				delete styles[style_to_remove];

				let style_string = '';

				for (let prop in styles) {
					style_string += `${prop}: ${styles[prop]}; `;
				}

				if (style_string.trim() === '') {
					if (use_ns) {
						element.removeAttributeNS(null, 'style');
					}
					else {
						element.removeAttribute('style');
					}
				}
				else {
					if (use_ns) {
						element.setAttributeNS(null, key, style_string.trim());
					}
					else {
						element.setAttribute(key, style_string.trim());
					}
				}
			}
			else {
				if (use_ns) {
					element.removeAttributeNS(null, key);
				}
				else {
					element.removeAttribute(key);
				}
			}
		}
	}

	// Temporary visual aid function.
	// TO DO: remove.
	#addDebugGrid(spacing, label_spacing) {
		const width = this.width;
		const height = this.height;

		// Add a group element to hold the grid lines and labels.
		const grid = document.createElementNS(SVGNS, 'g');

		grid.setAttribute('id', 'grid');
		this.svg.appendChild(grid);

		// Add the vertical grid lines and labels.
		for (let x = 0; x <= width; x += spacing) {
			const line = document.createElementNS(SVGNS, 'line');

			this.#addAttributesNS(line, {x1: x, y1: 0, x2: x, y2: height, 'stroke-width': 1, 'stroke': 'gray',
				'stroke-dasharray' : '2'
			});
			grid.appendChild(line);

			if (x % (spacing * label_spacing) === 0) {
				const label = document.createElementNS(SVGNS, 'text');

				this.#addAttributesNS(label, {x: x, y: 2, 'dominant-baseline': 'hanging', 'text-anchor': 'middle',
					'fill' : 'gray'
				});

				label.textContent = x;
				grid.appendChild(label);
			}
		}

		// Add the horizontal grid lines and labels.
		for (let y = 0; y <= height; y += spacing) {
			const line = document.createElementNS(SVGNS, 'line');

			this.#addAttributesNS(line, {x1: 0, y1: y, x2: width, y2: y, 'stroke-width': 1, 'stroke': 'gray',
				'stroke-dasharray' : '2'
			});

			grid.appendChild(line);

			if (y % (spacing * label_spacing) === 0) {
				const label = document.createElementNS(SVGNS, 'text');

				this.#addAttributesNS(label, {x: 2, y: y + 5, 'text-anchor': 'start', 'fill' : 'gray'});

				label.textContent = y;
				grid.appendChild(label);
			}
		}

		// Add a tooltip that displays the coordinates on mouseover.
		const tooltip = document.createElementNS(SVGNS, 'text');

		this.#addAttributesNS(tooltip, {id: 'tooltip', x: 0, y: 0, fill: 'black', visibility: 'hidden'});

		this.svg.appendChild(tooltip);

		// Add mouseover and mouseout event listeners to the SVG element.
		this.svg.addEventListener('mouseover', (event) => {
			this.#addAttributesNS(tooltip, {
				x: event.x - this.svg.getBoundingClientRect().x + 11,
				y: event.y - this.svg.getBoundingClientRect().y + 15,
				visibility: 'visible'
			});
		});

		this.svg.addEventListener('mouseout', () => {
			this.#addAttributesNS(tooltip, {visibility: 'hidden'});
		});

		// Add mousemove event listener to update the tooltip coordinates
		this.svg.addEventListener('mousemove', (event) => {
			let x = event.clientX - this.svg.getBoundingClientRect().x;
			let y = event.clientY - this.svg.getBoundingClientRect().y;

			x = +x.toFixed(2);
			y = +y.toFixed(2);

			this.#addAttributesNS(tooltip, {
				x: event.x - this.svg.getBoundingClientRect().x + 11,
				y: event.y - this.svg.getBoundingClientRect().y + 15
			});

			tooltip.textContent = `(${x}, ${y})`;
		});
	}
}
