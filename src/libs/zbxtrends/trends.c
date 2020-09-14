/*
** Zabbix
** Copyright (C) 2001-2020 Zabbix SIA
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

#include "common.h"
#include "zbxtrends.h"

/******************************************************************************
 *                                                                            *
 * Function: trends_parse_base                                                *
 *                                                                            *
 * Purpose: parse period base from trend function shift argument              *
 *                                                                            *
 * Parameters: period_shift - [IN] the history period shift                   *
 *             base         - [OUT] the period shift base (now/?)             *
 *             error        - [OUT] the error message if parsing failed       *
 *                                                                            *
 * Return value: SUCCEED - period was parsed successfully                     *
 *               FAIL    - invalid time period was specified                  *
 *                                                                            *
 ******************************************************************************/
static int	trends_parse_base(const char *period_shift, zbx_time_unit_t *base, char **error)
{
	zbx_time_unit_t	time_unit;

	if (0 != strncmp(period_shift, "now/", 4))
	{
		*error = zbx_strdup(*error, "invalid period shift expression");
		return FAIL;
	}

	if (ZBX_TIME_UNIT_UNKNOWN == (time_unit = zbx_tm_str_to_unit(period_shift + 4)))
	{
		*error = zbx_strdup(*error, "invalid period shift cycle");
		return FAIL;
	}

	*base = time_unit;
	return SUCCEED;
}

/******************************************************************************
 *                                                                            *
 * Function: trends_parse_base                                                *
 *                                                                            *
 * Purpose: parse largest period base from function parameters                 *
 *                                                                            *
 * Parameters: params - [IN] the function parameters                          *
 *             base   - [OUT] the period shift base (now/?)                   *
 *             error  - [OUT] the error message if parsing failed             *
 *                                                                            *
 * Return value: SUCCEED - period was parsed successfully                     *
 *               FAIL    - invalid time period was specified                  *
 *                                                                            *
 ******************************************************************************/
int	zbx_trends_parse_base(const char *params, zbx_time_unit_t *base, char **error)
{
	zbx_time_unit_t	time_unit = ZBX_TIME_UNIT_UNKNOWN;
	char		*period_shift, *ptr;
	int		ret = FAIL;

	period_shift = zbx_function_get_param_dyn(params, 2);

	for (ptr = period_shift; NULL != (ptr = strchr(ptr, '/'));)
	{
		zbx_time_unit_t	tu;

		if (ZBX_TIME_UNIT_UNKNOWN == (tu = zbx_tm_str_to_unit(++ptr)))
		{
			*error = zbx_strdup(*error, "invalid period shift cycle");
			goto out;
		}

		if (tu > time_unit)
			time_unit = tu;
	}

	if (ZBX_TIME_UNIT_UNKNOWN == time_unit)
	{
		*error = zbx_strdup(*error, "invalid period shift expression");
		goto out;
	}

	*base = time_unit;
	ret = SUCCEED;
out:
	zbx_free(period_shift);
	return ret;
}

/******************************************************************************
 *                                                                            *
 * Function: zbx_trends_parse_range                                           *
 *                                                                            *
 * Purpose: parse trend function period arguments into time range             *
 *                                                                            *
 * Parameters: period       - [IN] the history period                         *
 *             period_shift - [IN] the history period shift                   *
 *             start        - [OUT] the period start time in seconds since    *
 *                                  Epoch                                     *
 *             end          - [OUT] the period end time in seconds since      *
 *                                  Epoch                                     *
 *             error        - [OUT] the error message if parsing failed       *
 *                                                                            *
 * Return value: SUCCEED - period was parsed successfully                     *
 *               FAIL    - invalid time period was specified                  *
 *                                                                            *
 * Comments: Daylight saving changes are applied when parsing ranges with     *
 *           day+ used as period base (now/?).                                *
 *                                                                            *
 ******************************************************************************/
int	zbx_trends_parse_range(const char *period, const char *period_shift, int *start, int *end, char **error)
{
	const char	*ptr;
	int		period_num;
	zbx_time_unit_t	period_unit, base;
	size_t		len;

	/* parse period */

	if (FAIL == zbx_tm_parse_period(period, &len, &period_num, &period_unit, error))
		return FAIL;

	if ('\0' != period[len])
	{
		*error = zbx_dsprintf(*error, "unknown characters following period time unit \"%s\"", ptr);
		return FAIL;
	}

	/* parse period shift */

	if (FAIL == trends_parse_base(period_shift, &base, error))
		return FAIL;

	ZBX_UNUSED(start);
	ZBX_UNUSED(end);


	return SUCCEED;
}
