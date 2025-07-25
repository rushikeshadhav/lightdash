import { type BaseAiAgent } from '@lightdash/common';
import {
    ActionIcon,
    Alert,
    Anchor,
    Box,
    Button,
    Group,
    LoadingOverlay,
    MultiSelect,
    Paper,
    Stack,
    Tabs,
    TagsInput,
    Text,
    Textarea,
    TextInput,
    Title,
    Tooltip,
} from '@mantine-8/core';
import { useForm, zodResolver } from '@mantine/form';
import {
    IconAdjustmentsAlt,
    IconArrowLeft,
    IconBook2,
    IconCheck,
    IconInfoCircle,
    IconPlug,
    IconRefresh,
    IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useState, type FC } from 'react';
import { useNavigate, useParams } from 'react-router';
import { z } from 'zod';
import { LightdashUserAvatar } from '../../../components/Avatar';
import MantineIcon from '../../../components/common/MantineIcon';
import MantineModal from '../../../components/common/MantineModal';
import Page from '../../../components/common/Page/Page';
import { useGetSlack, useSlackChannels } from '../../../hooks/slack/useSlack';
import { useProject } from '../../../hooks/useProject';
import useApp from '../../../providers/App/useApp';
import { ConversationsList } from '../../features/aiCopilot/components/ConversationsList';
import { SlackIntegrationSteps } from '../../features/aiCopilot/components/SlackIntegrationSteps';
import { useAiAgentPermission } from '../../features/aiCopilot/hooks/useAiAgentPermission';
import { useDeleteAiAgentMutation } from '../../features/aiCopilot/hooks/useOrganizationAiAgents';
import {
    useProjectAiAgent,
    useProjectAiAgents,
    useProjectCreateAiAgentMutation,
    useProjectUpdateAiAgentMutation,
} from '../../features/aiCopilot/hooks/useProjectAiAgents';
const formSchema: z.ZodType<
    Pick<
        BaseAiAgent,
        'name' | 'integrations' | 'tags' | 'instruction' | 'imageUrl'
    >
> = z.object({
    name: z.string().min(1),
    integrations: z.array(
        z.object({
            type: z.literal('slack'),
            channelId: z.string().min(1),
        }),
    ),
    tags: z.array(z.string()).nullable(),
    instruction: z.string().nullable(),
    imageUrl: z.string().url().nullable(),
});

type Props = {
    isCreateMode?: boolean;
};

const ProjectAiAgentEditPage: FC<Props> = ({ isCreateMode = false }) => {
    const { agentUuid, projectUuid } = useParams<{
        agentUuid: string;
        projectUuid: string;
    }>();
    const canManageAgents = useAiAgentPermission({
        action: 'manage',
        projectUuid,
    });

    const navigate = useNavigate();
    const { user } = useApp();

    const [deleteModalOpen, setDeleteModalOpen] = useState(false);

    const { data: project } = useProject(projectUuid);
    const { mutateAsync: createAgent, isLoading: isCreating } =
        useProjectCreateAiAgentMutation(projectUuid!);
    const { mutateAsync: updateAgent, isLoading: isUpdating } =
        useProjectUpdateAiAgentMutation(projectUuid!);
    const { mutateAsync: deleteAgent } = useDeleteAiAgentMutation();

    const actualAgentUuid = !isCreateMode && agentUuid ? agentUuid : undefined;

    const { data: agent, isLoading: isLoadingAgent } = useProjectAiAgent(
        projectUuid,
        actualAgentUuid,
    );

    const { data: slackInstallation, isLoading: isLoadingSlackInstallation } =
        useGetSlack();

    const { data: agents, isSuccess: isSuccessAgents } =
        useProjectAiAgents(projectUuid);

    const {
        data: slackChannels,
        refresh: refreshChannels,
        isRefreshing,
    } = useSlackChannels(
        '',
        {
            excludeArchived: true,
            excludeDms: true,
            excludeGroups: true,
        },
        {
            enabled: !!slackInstallation?.organizationUuid && isSuccessAgents,
        },
    );

    const slackChannelOptions = useMemo(
        () =>
            slackChannels?.map((channel) => ({
                value: channel.id,
                label: channel.name,
                disabled: agents?.some((a) =>
                    a.integrations.some((i) => i.channelId === channel.id),
                ),
            })) ?? [],
        [slackChannels, agents],
    );

    const form = useForm<z.infer<typeof formSchema>>({
        initialValues: {
            name: '',
            integrations: [],
            tags: null,
            instruction: null,
            imageUrl: null,
        },
        validate: zodResolver(formSchema),
    });

    useEffect(() => {
        if (isCreateMode || !agent) {
            return;
        }

        if (!form.initialized) {
            const values = {
                name: agent.name,
                integrations: agent.integrations,
                tags: agent.tags && agent.tags.length > 0 ? agent.tags : null,
                instruction: agent.instruction,
                imageUrl: agent.imageUrl,
            };
            form.setValues(values);
            form.resetDirty(values);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agent, isCreateMode]);

    const handleBack = () => {
        void navigate(-1);
    };

    const handleSubmit = form.onSubmit(async (values) => {
        if (!projectUuid || !user?.data) {
            return;
        }

        if (isCreateMode) {
            await createAgent({
                ...values,
                projectUuid,
            });
        } else if (actualAgentUuid) {
            await updateAgent({
                uuid: actualAgentUuid,
                projectUuid,
                ...values,
            });
        }
    });

    const handleDeleteClick = useCallback(() => {
        setDeleteModalOpen(true);
    }, []);

    const handleDelete = useCallback(async () => {
        if (!actualAgentUuid || !user?.data || !projectUuid || !agent) {
            return;
        }

        await deleteAgent(actualAgentUuid);

        setDeleteModalOpen(false);
    }, [actualAgentUuid, deleteAgent, user?.data, projectUuid, agent]);

    const handleCancelDelete = useCallback(() => {
        setDeleteModalOpen(false);
    }, []);

    useEffect(() => {
        if (!canManageAgents) {
            void navigate(`/projects/${projectUuid}/ai-agents`);
        }
    }, [canManageAgents, navigate, projectUuid]);

    if (!isCreateMode && actualAgentUuid && !agent && !isLoadingAgent) {
        return (
            <Page
                withFullHeight
                withCenteredRoot
                withCenteredContent
                withXLargePaddedContent
                withLargeContent
                withFixedContent
            >
                <Stack gap="md">
                    <Group gap="xs">
                        <Button
                            variant="subtle"
                            leftSection={<MantineIcon icon={IconArrowLeft} />}
                            onClick={handleBack}
                        >
                            Back to Agents
                        </Button>
                    </Group>
                    <Paper
                        p="xl"
                        shadow="subtle"
                        component={Stack}
                        gap="xxs"
                        align="center"
                        withBorder
                        style={{ borderStyle: 'dashed' }}
                    >
                        <Title order={5}>Agent not found</Title>
                        <Text size="sm" c="dimmed">
                            The agent you are looking for does not exist.
                        </Text>
                    </Paper>
                </Stack>
            </Page>
        );
    }

    return (
        <Page
            withFullHeight
            withCenteredRoot
            withCenteredContent
            withXLargePaddedContent
            withLargeContent
            withFixedContent
        >
            <Stack gap="xs">
                <div>
                    <Button
                        variant="subtle"
                        leftSection={<MantineIcon icon={IconArrowLeft} />}
                        onClick={handleBack}
                    >
                        Back
                    </Button>
                </div>
                <Group justify="space-between" wrap="nowrap" align="center">
                    <Group gap="sm" align="center" flex="1" wrap="nowrap">
                        <LightdashUserAvatar
                            name={isCreateMode ? '+' : form.values.name}
                            variant="filled"
                            src={
                                !isCreateMode ? form.values.imageUrl : undefined
                            }
                            size={48}
                        />
                        <Stack gap={0}>
                            <Title order={2} lineClamp={1} w="100%">
                                {isCreateMode
                                    ? 'New Agent'
                                    : agent?.name || 'Agent'}
                            </Title>
                            <Text size="sm" c="dimmed">
                                Last modified:{' '}
                                {new Date(
                                    agent?.updatedAt ?? new Date(),
                                ).toLocaleString()}
                            </Text>
                        </Stack>
                    </Group>
                    <Group justify="flex-end" gap="xs">
                        {!isCreateMode && (
                            <Button
                                size="compact-sm"
                                variant="outline"
                                color="red"
                                leftSection={<MantineIcon icon={IconTrash} />}
                                onClick={handleDeleteClick}
                            >
                                Delete agent
                            </Button>
                        )}
                        <Button
                            size="compact-sm"
                            onClick={() => handleSubmit()}
                            loading={isCreating || isUpdating}
                            leftSection={<MantineIcon icon={IconCheck} />}
                            disabled={
                                isCreateMode ? !form.isValid() : !form.isDirty()
                            }
                        >
                            {isCreateMode ? 'Create agent' : 'Save changes'}
                        </Button>
                    </Group>
                </Group>

                <Tabs defaultValue="setup">
                    <Tabs.List>
                        <Tabs.Tab value="setup">Setup</Tabs.Tab>
                        {!isCreateMode && (
                            <Tabs.Tab value="conversations">
                                Conversations
                            </Tabs.Tab>
                        )}
                    </Tabs.List>

                    <Tabs.Panel value="setup" pt="lg">
                        <form>
                            <Stack gap="sm">
                                <Paper p="xl">
                                    <Group align="center" gap="xs" mb="md">
                                        <Paper p="xxs" withBorder radius="sm">
                                            <MantineIcon
                                                icon={IconAdjustmentsAlt}
                                                size="md"
                                            />
                                        </Paper>
                                        <Title order={5} c="gray.9" fw={700}>
                                            Basic information
                                        </Title>
                                    </Group>
                                    <Stack>
                                        <Group>
                                            <TextInput
                                                label="Agent Name"
                                                placeholder="Enter a name for this agent"
                                                {...form.getInputProps('name')}
                                                style={{ flexGrow: 1 }}
                                                variant="subtle"
                                            />
                                            <Tooltip label="Agents can only be created in the context the current project">
                                                <TextInput
                                                    label="Project"
                                                    placeholder="Enter a project"
                                                    value={project?.name}
                                                    readOnly
                                                    style={{ flexGrow: 1 }}
                                                    variant="subtle"
                                                />
                                            </Tooltip>
                                        </Group>
                                        <TextInput
                                            style={{ flexGrow: 1 }}
                                            miw={200}
                                            variant="subtle"
                                            label="Avatar image URL"
                                            description="Please provide an image url like https://example.com/avatar.jpg. If not provided, a default avatar will be used."
                                            placeholder="https://example.com/avatar.jpg"
                                            type="url"
                                            {...form.getInputProps('imageUrl')}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                form.setFieldValue(
                                                    'imageUrl',
                                                    value ? value : null,
                                                );
                                            }}
                                        />
                                        <TagsInput
                                            variant="subtle"
                                            label="Tags"
                                            placeholder="Select tags"
                                            {...form.getInputProps('tags')}
                                            value={
                                                form.getInputProps('tags')
                                                    .value ?? []
                                            }
                                            onChange={(value) => {
                                                form.setFieldValue(
                                                    'tags',
                                                    value.length > 0
                                                        ? value
                                                        : null,
                                                );
                                            }}
                                        />
                                    </Stack>
                                </Paper>

                                <Paper p="xl">
                                    <Group align="center" gap="xs">
                                        <Paper p="xxs" withBorder radius="sm">
                                            <MantineIcon
                                                icon={IconBook2}
                                                size="md"
                                            />
                                        </Paper>
                                        <Title order={5} c="gray.9" fw={700}>
                                            Knowledge & expertise
                                        </Title>
                                    </Group>
                                    <Text size="sm" c="dimmed" mb="md">
                                        Define your Agent's capabilities by
                                        providing context across different
                                        areas.
                                    </Text>

                                    <Textarea
                                        variant="subtle"
                                        label="Instructions"
                                        description="Instructions set the overall behavior and task for the agent. This defines how it should respond and what its purpose is."
                                        placeholder="You are a helpful assistant that specializes in sales data analytics."
                                        resize="vertical"
                                        {...form.getInputProps('instruction')}
                                    />
                                </Paper>

                                <Paper p="xl">
                                    <Group align="center" gap="xs" mb="md">
                                        <Paper p="xxs" withBorder radius="sm">
                                            <MantineIcon
                                                icon={IconPlug}
                                                size="md"
                                            />
                                        </Paper>
                                        <Title order={5} c="gray.9" fw={700}>
                                            Integrations
                                        </Title>
                                    </Group>
                                    <Stack gap="md">
                                        <Title order={6}>Slack</Title>

                                        <LoadingOverlay
                                            visible={isLoadingSlackInstallation}
                                        />

                                        {!slackInstallation?.organizationUuid ? (
                                            <Alert
                                                color="yellow"
                                                icon={
                                                    <MantineIcon
                                                        icon={IconInfoCircle}
                                                    />
                                                }
                                            >
                                                <Text fw={500} mb="xs">
                                                    Slack integration required
                                                </Text>
                                                <Text size="sm">
                                                    To enable AI agent
                                                    interactions through Slack,
                                                    please connect your Slack
                                                    workspace in the{' '}
                                                    <Anchor
                                                        href="/generalSettings/integrations"
                                                        target="_blank"
                                                        fz="sm"
                                                    >
                                                        Integrations settings
                                                    </Anchor>
                                                    . Once connected, you can
                                                    select channels where this
                                                    agent will be available.
                                                </Text>
                                            </Alert>
                                        ) : (
                                            <Box>
                                                <SlackIntegrationSteps
                                                    slackInstallation={
                                                        !!slackInstallation?.organizationUuid
                                                    }
                                                    channelsConfigured={form.values.integrations.some(
                                                        (i) =>
                                                            i.type ===
                                                                'slack' &&
                                                            i.channelId,
                                                    )}
                                                />

                                                <Stack gap="xs" mt="md">
                                                    <MultiSelect
                                                        variant="subtle"
                                                        disabled={
                                                            isRefreshing ||
                                                            !slackInstallation?.organizationUuid
                                                        }
                                                        description={
                                                            !slackInstallation?.organizationUuid
                                                                ? 'You need to connect Slack first in the Integrations settings before you can configure AI agents.'
                                                                : undefined
                                                        }
                                                        labelProps={{
                                                            style: {
                                                                width: '100%',
                                                            },
                                                        }}
                                                        label="Channels"
                                                        placeholder="Pick a channel"
                                                        data={
                                                            slackChannelOptions
                                                        }
                                                        value={form.values.integrations.map(
                                                            (i) => i.channelId,
                                                        )}
                                                        searchable
                                                        rightSectionPointerEvents="all"
                                                        rightSection={
                                                            <Tooltip
                                                                withArrow
                                                                withinPortal
                                                                label="Refresh Slack Channels"
                                                            >
                                                                <ActionIcon
                                                                    variant="transparent"
                                                                    onClick={
                                                                        refreshChannels
                                                                    }
                                                                >
                                                                    <MantineIcon
                                                                        icon={
                                                                            IconRefresh
                                                                        }
                                                                    />
                                                                </ActionIcon>
                                                            </Tooltip>
                                                        }
                                                        onChange={(value) => {
                                                            form.setFieldValue(
                                                                'integrations',
                                                                value.map(
                                                                    (v) =>
                                                                        ({
                                                                            type: 'slack',
                                                                            channelId:
                                                                                v,
                                                                        } as const),
                                                                ),
                                                            );
                                                        }}
                                                    />
                                                </Stack>
                                            </Box>
                                        )}
                                    </Stack>
                                </Paper>
                            </Stack>
                        </form>
                    </Tabs.Panel>
                    <Tabs.Panel value="conversations" pt="lg">
                        <ConversationsList
                            agentUuid={actualAgentUuid!}
                            agentName={agent?.name ?? 'Agent'}
                            allUsers={canManageAgents}
                        />
                    </Tabs.Panel>
                </Tabs>

                <MantineModal
                    opened={deleteModalOpen}
                    onClose={handleCancelDelete}
                    title="Delete Agent"
                    icon={IconTrash}
                    actions={
                        <Group>
                            <Button
                                variant="subtle"
                                onClick={handleCancelDelete}
                            >
                                Cancel
                            </Button>
                            <Button color="red" onClick={handleDelete}>
                                Delete
                            </Button>
                        </Group>
                    }
                >
                    <Stack gap="md">
                        <Text>
                            Are you sure you want to delete this agent? This
                            action cannot be undone.
                        </Text>
                    </Stack>
                </MantineModal>
            </Stack>
        </Page>
    );
};

export default ProjectAiAgentEditPage;
