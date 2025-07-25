import {
    AI_DEFAULT_MAX_QUERY_LIMIT,
    CompiledField,
    Explore,
    FilterRule,
    getErrorMessage,
    getFields,
    getItemId,
    renderFilterRuleSqlFromField,
    SupportedDbtAdapter,
    WeekDay,
} from '@lightdash/common';
import { serializeData } from './serializeData';

/**
 * Validate that all selected fields exist in the explore
 * @param explore
 * @param selectedFieldIds
 */
export function validateSelectedFieldsExistence(
    explore: Explore,
    selectedFieldIds: string[],
) {
    const exploreFieldIds = getFields(explore).map(getItemId);
    const nonExploreFields = selectedFieldIds.filter(
        (f) => !exploreFieldIds.includes(f),
    );

    if (nonExploreFields.length) {
        throw new Error(`The following fields do not exist in the selected explore.

Fields:
\`\`\`json
${nonExploreFields.join('\n')}
\`\`\``);
    }
}

function validateFilterRule(filterRule: FilterRule, field: CompiledField) {
    try {
        renderFilterRuleSqlFromField(
            filterRule,
            field,
            // ! The following args are used to actually render the SQL, we don't care about the ouput, just that it doesn't throw
            '"',
            "'",
            '\\',
            WeekDay.SUNDAY,
            SupportedDbtAdapter.BIGQUERY,
        );
    } catch (e) {
        throw new Error(`
Error: ${getErrorMessage(e)}
Filter Rule:
${serializeData(filterRule, 'json')}`);
    }
}

export function validateFilterRules(
    explore: Explore,
    filterRules: FilterRule[],
) {
    const exploreFields = getFields(explore);
    const exploreFieldIds = exploreFields.map(getItemId);
    const filterRuleErrors: string[] = [];

    filterRules.forEach((rule) => {
        const exploreFieldIndex = exploreFieldIds.indexOf(rule.target.fieldId);
        const field = exploreFields[exploreFieldIndex];

        if (!field) {
            filterRuleErrors.push(
                `Error: the field with id "${
                    rule.target.fieldId
                }" does not exist in the selected explore.
FilterRule:
${serializeData(rule, 'json')}`,
            );
            return;
        }

        try {
            validateFilterRule(rule, field);
        } catch (e) {
            filterRuleErrors.push(getErrorMessage(e));
        }
    });

    if (filterRuleErrors.length) {
        const filterRuleErrorStrings = filterRuleErrors
            .map((e) => `<filterRuleError>${e}</filterRuleError>`)
            .join('\n');

        throw new Error(`The following filter rules are invalid:

Errors:

${filterRuleErrorStrings}`);
    }
}
