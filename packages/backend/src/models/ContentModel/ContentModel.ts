import {
    KnexPaginateArgs,
    KnexPaginatedData,
    SummaryContent,
} from '@lightdash/common';
import { Knex } from 'knex';
import KnexPaginate from '../../database/pagination';
import { dashboardContentConfiguration } from './ContentConfigurations/DashboardContentConfiguration';
import { dbtExploreChartContentConfiguration } from './ContentConfigurations/DbtExploreChartContentConfiguration';
import { spaceContentConfiguration } from './ContentConfigurations/SpaceContentConfiguration';
import { sqlChartContentConfiguration } from './ContentConfigurations/SqlChartContentConfiguration';

import {
    ContentArgs,
    ContentFilters,
    SummaryContentRow,
} from './ContentModelTypes';

/**
 Content model is responsible for fetching all content types in a single query, leveraging UNION ALL clauses.
 It uses content configurations to determine which queries to run and how to convert the results.
 The queries need to have the exact same columns! Any additional data needs to be inside the metadata jsonb column.

 If you want to add a new content type, you need to create a new content configuration and add it to the contentConfigurations array.
 */
export class ContentModel {
    private database: Knex;

    private contentConfigurations = [
        sqlChartContentConfiguration,
        dbtExploreChartContentConfiguration,
        dashboardContentConfiguration,
        spaceContentConfiguration,
    ];

    constructor(args: { database: Knex }) {
        this.database = args.database;
    }

    getDatabase() {
        return this.database;
    }

    async findSummaryContents(
        filters: ContentFilters,
        queryArgs: ContentArgs,
        paginateArgs?: KnexPaginateArgs,
    ): Promise<KnexPaginatedData<SummaryContent[]>> {
        const matchingConfigurations = this.contentConfigurations.filter(
            (config) => config.shouldQueryBeIncluded(filters),
        );

        if (matchingConfigurations.length === 0) {
            return {
                data: [],
            };
        }

        const query = this.database.select<SummaryContentRow[]>('*');

        matchingConfigurations.forEach((config) => {
            void query.unionAll(config.getSummaryQuery(this.database, filters));
        });

        if (queryArgs.sortBy) {
            void query.orderBy([
                {
                    column: 'content_type_rank',
                    order: 'ASC',
                },
                {
                    column: queryArgs.sortBy,
                    order: queryArgs.sortDirection ?? 'DESC',
                },
            ]);
        } else {
            void query.orderBy([
                {
                    column: 'content_type_rank',
                    order: 'ASC',
                },
                {
                    column: 'last_updated_at',
                    order: 'DESC',
                },
            ]);
        }

        const { pagination, data } = await KnexPaginate.paginate(
            query,
            paginateArgs,
        );

        return {
            pagination,
            data: data.map((result) => {
                const matchingConfig = matchingConfigurations.find((config) =>
                    config.shouldRowBeConverted(result),
                );

                if (!matchingConfig) {
                    throw new Error(
                        `No matching configuration found to convert content row with uuid ${result.uuid}`,
                    );
                }

                return matchingConfig.convertSummaryRow(result);
            }),
        };
    }
}
