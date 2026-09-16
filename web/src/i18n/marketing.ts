/**
 * Sprint 11 marketing strings.
 *
 * Kept out of messages.ts (already ~1900 lines) and merged into it by spread,
 * so the accepted locale tables stay untouched. One row carries all three
 * translations, which makes a missing locale a compile-time gap instead of a
 * silent English fallback: ROWS is a tuple, so a row with only two strings
 * fails typecheck.
 */
import type { UiLocale } from './messages';

/** [key, en, zh, fr] */
type Row = [string, string, string, string];

const ROWS: Row[] = [
  /* --------------------------------------------------------------- entry */
  ['marketing.metaTitle', 'Marketing', '营销群发', 'Marketing'],
  ['marketing.metaDescription', 'Generate AI marketing copy, select recipients, schedule throttled campaigns and track delivery across channels.', '用 AI 生成营销文案，筛选收件人，按限速排期群发并跟踪各渠道送达效果。', 'Générez des textes marketing par IA, sélectionnez les destinataires, planifiez des campagnes à débit maîtrisé et suivez la diffusion.'],
  ['marketing.title', 'Marketing campaigns', '营销群发', 'Campagnes marketing'],
  ['marketing.subtitle', 'AI copy, audience selection and throttled delivery in one flow.', 'AI 文案、受众筛选与限速发送，一站式完成。', 'Texte IA, sélection d’audience et envoi à débit maîtrisé.'],
  ['marketing.homeEntryTitle', 'Marketing', '营销群发', 'Marketing'],
  ['marketing.homeEntryDesc', 'AI copy and batch campaigns', 'AI 文案与批量群发', 'Texte IA et campagnes groupées'],
  ['marketing.newCampaign', 'New campaign', '新建活动', 'Nouvelle campagne'],
  ['marketing.templatesEntry', 'Templates', '文案模板', 'Modèles'],
  ['marketing.historyEntry', 'Send history', '发送记录', 'Historique d’envoi'],
  ['marketing.searchPlaceholder', 'Search campaigns', '搜索活动', 'Rechercher une campagne'],
  ['marketing.loadMore', 'Load more', '加载更多', 'Charger plus'],
  ['marketing.totalCampaigns', '{n} campaigns', '共 {n} 个活动', '{n} campagnes'],
  ['marketing.empty', 'No campaigns yet', '还没有营销活动', 'Aucune campagne pour l’instant'],
  ['marketing.emptyHint', 'Create your first campaign: AI writes the copy, you pick the audience.', '创建第一个活动：AI 写文案，你来选受众。', 'Créez votre première campagne : l’IA rédige, vous choisissez l’audience.'],
  ['marketing.demoNotice', 'Sample data. Real campaigns appear once the marketing API is connected.', '示例数据。接入营销 API 后将显示真实活动。', 'Données d’exemple. Les vraies campagnes s’afficheront une fois l’API connectée.'],
  ['marketing.demoHide', 'Hide sample data', '隐藏示例数据', 'Masquer les exemples'],

  /* ------------------------------------------------------------- overview */
  ['marketing.overview.monthSent', 'Sent this month', '本月已发送', 'Envoyés ce mois'],
  ['marketing.overview.openRate', 'Open rate', '打开率', 'Taux d’ouverture'],
  ['marketing.overview.conversionRate', 'Conversion rate', '转化率', 'Taux de conversion'],
  ['marketing.overview.activeCampaigns', 'Active campaigns', '进行中的活动', 'Campagnes actives'],

  /* --------------------------------------------------------------- status */
  ['marketing.status.all', 'All', '全部', 'Toutes'],
  ['marketing.status.draft', 'Draft', '草稿', 'Brouillon'],
  ['marketing.status.running', 'Running', '发送中', 'En cours'],
  ['marketing.status.paused', 'Paused', '已暂停', 'En pause'],
  ['marketing.status.completed', 'Completed', '已完成', 'Terminée'],
  ['marketing.status.cancelled', 'Cancelled', '已取消', 'Annulée'],

  /* ----------------------------------------------------------------- card */
  ['marketing.card.recipients', '{n} recipients', '{n} 位收件人', '{n} destinataires'],
  ['marketing.card.channels', 'Channels', '渠道', 'Canaux'],
  ['marketing.card.created', 'Created {time}', '创建于 {time}', 'Créée le {time}'],
  ['marketing.card.progress', 'Progress', '进度', 'Progression'],
  ['marketing.card.open', 'Open', '打开', 'Ouvrir'],
  ['marketing.card.sent', 'Sent', '已发送', 'Envoyés'],
  ['marketing.card.failed', 'Failed', '失败', 'Échecs'],
  ['marketing.card.start', 'Start', '开始发送', 'Démarrer'],
  ['marketing.card.pause', 'Pause', '暂停', 'Pause'],
  ['marketing.card.cancel', 'Cancel', '取消', 'Annuler'],

  /* ---------------------------------------------------------------- enums */
  ['marketing.goal.promotion', 'Promotion', '促销', 'Promotion'],
  ['marketing.goal.new_arrival', 'New arrival', '上新', 'Nouveauté'],
  ['marketing.goal.festival', 'Festival', '节日', 'Fête'],
  ['marketing.goal.winback', 'Win-back', '唤醒', 'Reconquête'],
  ['marketing.goal.custom', 'Custom', '自定义', 'Personnalisé'],
  ['marketing.tone.professional', 'Professional', '专业', 'Professionnel'],
  ['marketing.tone.friendly', 'Friendly', '友好', 'Chaleureux'],
  ['marketing.tone.playful', 'Playful', '活泼', 'Ludique'],
  ['marketing.tone.urgent', 'Urgent', '紧迫', 'Urgent'],
  ['marketing.length.short', 'Short', '简短', 'Court'],
  ['marketing.length.standard', 'Standard', '标准', 'Standard'],
  ['marketing.length.detailed', 'Detailed', '详细', 'Détaillé'],
  ['marketing.language.en', 'English', '英文', 'Anglais'],
  ['marketing.language.fr', 'French', '法文', 'Français'],
  ['marketing.language.sw', 'Swahili', '斯瓦希里文', 'Swahili'],

  /* --------------------------------------------------------------- wizard */
  ['marketing.wizard.title', 'Create campaign', '新建活动', 'Créer une campagne'],
  ['marketing.wizard.step1', '1. Content', '1. 文案', '1. Contenu'],
  ['marketing.wizard.step2', '2. Audience', '2. 受众', '2. Audience'],
  ['marketing.wizard.step3', '3. Send', '3. 发送', '3. Envoi'],
  ['marketing.wizard.stepContentTitle', 'Write the message', '撰写消息', 'Rédiger le message'],
  ['marketing.wizard.stepAudienceTitle', 'Choose recipients', '选择收件人', 'Choisir les destinataires'],
  ['marketing.wizard.stepSendTitle', 'Delivery settings', '发送设置', 'Paramètres d’envoi'],
  ['marketing.wizard.next', 'Next', '下一步', 'Suivant'],
  ['marketing.wizard.previous', 'Back', '上一步', 'Retour'],
  ['marketing.wizard.submit', 'Create campaign', '创建活动', 'Créer la campagne'],
  ['marketing.wizard.name', 'Campaign name', '活动名称', 'Nom de la campagne'],
  ['marketing.wizard.namePlaceholder', 'Easter hardware promo', '复活节五金促销', 'Promo quincaillerie de Pâques'],
  ['marketing.wizard.cancel', 'Discard draft', '放弃草稿', 'Abandonner'],

  /* ------------------------------------------------------------- ai panel */
  ['marketing.ai.title', 'AI copywriting', 'AI 文案生成', 'Rédaction IA'],
  ['marketing.ai.prompt', 'What are you promoting?', '推广什么内容？', 'Que promouvez-vous ?'],
  ['marketing.ai.audience', 'Audience', '目标受众', 'Audience'],
  ['marketing.ai.promptPlaceholder', 'Galvanised roofing sheets, 15% off until Sunday', '镀锌屋顶板，周日前 8.5 折', 'Tôles galvanisées, -15 % jusqu’à dimanche'],
  ['marketing.ai.audiencePlaceholder', 'Hardware resellers in Dar es Salaam', '达累斯萨拉姆的五金经销商', 'Revendeurs de quincaillerie à Dar es Salaam'],
  ['marketing.ai.goal', 'Goal', '营销目标', 'Objectif'],
  ['marketing.ai.language', 'Language', '文案语言', 'Langue'],
  ['marketing.ai.tone', 'Tone', '语气', 'Ton'],
  ['marketing.ai.length', 'Length', '长度', 'Longueur'],
  ['marketing.ai.generate', 'Generate', '生成文案', 'Générer'],
  ['marketing.ai.regenerate', 'Regenerate', '重新生成', 'Régénérer'],
  ['marketing.ai.generating', 'Writing…', '生成中…', 'Rédaction…'],
  ['marketing.ai.refine', 'Refinement', '修改意见', 'Ajustement'],
  ['marketing.ai.refinePlaceholder', 'More playful, mention free delivery', '更活泼一些，并提到免运费', 'Plus ludique, mentionner la livraison offerte'],
  ['marketing.ai.refineAction', 'Apply', '应用', 'Appliquer'],
  ['marketing.ai.cacheHit', 'Served from semantic cache', '命中语义缓存', 'Servi depuis le cache sémantique'],
  ['marketing.ai.cacheHint', 'Identical inputs reuse the cached draft (TTL 24h). Change the prompt or refine to get a new version.', '相同输入会复用缓存草稿（TTL 24 小时）。修改提示词或使用“修改意见”可获得新版本。', 'Des entrées identiques réutilisent le brouillon en cache (TTL 24 h). Modifiez la consigne ou ajustez pour obtenir une nouvelle version.'],
  ['marketing.ai.empty', 'Describe the offer and generate a draft.', '描述推广内容后生成草稿。', 'Décrivez l’offre puis générez un brouillon.'],
  ['marketing.ai.orTemplate', 'or start from a template', '或从模板开始', 'ou partir d’un modèle'],
  ['marketing.ai.charHint', '{n} characters', '{n} 个字符', '{n} caractères'],

  /* --------------------------------------------------------------- editor */
  ['marketing.editor.title', 'Message', '消息内容', 'Message'],
  ['marketing.editor.bodyTitle', 'Title', '标题', 'Titre'],
  ['marketing.editor.body', 'Body', '正文', 'Corps'],
  ['marketing.editor.cta', 'Call to action', '行动号召', 'Appel à l’action'],
  ['marketing.editor.hashtags', 'Hashtags', '话题标签', 'Hashtags'],
  ['marketing.editor.imageSuggestion', 'Image brief', '配图建议', 'Brief visuel'],
  ['marketing.editor.sendable', 'Ready to send', '可以发送', 'Prêt à envoyer'],
  ['marketing.editor.notSendable', 'Add a title and body before sending', '请先填写标题和正文', 'Ajoutez un titre et un corps avant l’envoi'],
  ['marketing.editor.clear', 'Clear draft', '清空草稿', 'Effacer'],

  /* -------------------------------------------------------------- preview */
  ['marketing.preview.title', 'Channel preview', '渠道预览', 'Aperçu par canal'],
  ['marketing.preview.hint', 'Each platform renders the same copy with its own limits.', '同一份文案按各平台限制分别渲染。', 'Chaque plateforme rend le même texte selon ses limites.'],
  ['marketing.preview.truncated', 'Truncated to fit', '已按限制截断', 'Tronqué pour respecter la limite'],
  ['marketing.preview.charCount', '{n} / {limit} characters', '{n} / {limit} 字符', '{n} / {limit} caractères'],
  ['marketing.preview.empty', 'Generate copy to see the previews.', '生成文案后查看预览。', 'Générez un texte pour voir les aperçus.'],

  /* ------------------------------------------------------------ recipients */
  ['marketing.recipients.title', 'Recipients', '收件人', 'Destinataires'],
  ['marketing.recipients.hint', 'Sourced from the customer directory and its tags.', '来源于客户档案与标签。', 'Issus du répertoire clients et de ses étiquettes.'],
  ['marketing.recipients.searchPlaceholder', 'Search name, phone or email', '搜索姓名、手机号或邮箱', 'Rechercher nom, téléphone ou e-mail'],
  ['marketing.recipients.filterTags', 'Tags', '标签', 'Étiquettes'],
  ['marketing.recipients.allTags', 'All tags', '全部标签', 'Toutes les étiquettes'],
  ['marketing.recipients.filterChannels', 'Channels', '渠道', 'Canaux'],
  ['marketing.recipients.filterActivity', 'Activity', '活跃度', 'Activité'],
  ['marketing.recipients.activityAll', 'All', '全部', 'Tous'],
  ['marketing.recipients.activityActive', 'Active 30d', '近 30 天活跃', 'Actifs (30 j)'],
  ['marketing.recipients.activityInactive', 'Inactive', '不活跃', 'Inactifs'],
  ['marketing.recipients.selectAll', 'Select valid', '全选有效', 'Sélectionner les valides'],
  ['marketing.recipients.clear', 'Clear', '清空', 'Effacer'],
  ['marketing.recipients.selected', '{n} selected', '已选 {n} 人', '{n} sélectionnés'],
  ['marketing.recipients.valid', '{n} reachable', '{n} 人可送达', '{n} joignables'],
  ['marketing.recipients.invalid', '{n} unreachable', '{n} 人不可送达', '{n} injoignables'],
  ['marketing.recipients.validate', 'Validate selection', '校验所选', 'Vérifier la sélection'],
  ['marketing.recipients.empty', 'No customer matches these filters.', '没有客户符合当前筛选条件。', 'Aucun client ne correspond à ces filtres.'],
  ['marketing.recipients.reason.no_channel_account', 'Channel not connected', '渠道未连接', 'Canal non connecté'],
  ['marketing.recipients.reason.missing_handle', 'Missing phone or handle', '缺少手机号或账号', 'Téléphone ou identifiant manquant'],
  ['marketing.recipients.reason.opted_out', 'Opted out of marketing', '已退订营销消息', 'Désabonné des messages marketing'],
  ['marketing.recipients.invalidNotice', '{n} selected contacts cannot receive this campaign and will be skipped.', '所选的 {n} 位联系人无法接收本次活动，将被跳过。', '{n} contacts sélectionnés ne peuvent pas recevoir cette campagne et seront ignorés.'],

  /* ------------------------------------------------------------ send setup */
  ['marketing.send.mode', 'When', '发送时间', 'Quand'],
  ['marketing.send.modeImmediate', 'Send now', '立即发送', 'Envoyer maintenant'],
  ['marketing.send.modeScheduled', 'Schedule', '定时发送', 'Planifier'],
  ['marketing.send.scheduledAt', 'Start at', '开始时间', 'Heure de début'],
  ['marketing.send.perMinute', 'Messages per minute', '每分钟条数', 'Messages par minute'],
  ['marketing.send.interval', 'Interval (ms)', '间隔（毫秒）', 'Intervalle (ms)'],
  ['marketing.send.channels', 'Channels', '渠道', 'Canaux'],
  ['marketing.send.rateHint', 'Limit {min}–{max} per minute. A slower rate protects the sender account.', '限速 {min}–{max} 条/分钟。更慢的速度可保护发送账号。', 'Limite {min}–{max} par minute. Un débit plus lent protège le compte expéditeur.'],
  ['marketing.send.estimate', 'About {text} for {n} messages', '{n} 条消息约需 {text}', 'Environ {text} pour {n} messages'],
  ['marketing.send.clamped', 'Rate adjusted to stay inside the product limits.', '已自动调整至产品限速范围内。', 'Débit ajusté pour rester dans les limites produit.'],
  ['marketing.send.reviewTitle', 'Review', '确认信息', 'Vérification'],

  /* -------------------------------------------------------------- progress */
  ['marketing.progress.title', 'Sending', '发送中', 'Envoi en cours'],
  ['marketing.progress.done', '{done} / {total}', '{done} / {total}', '{done} / {total}'],
  ['marketing.progress.failed', '{n} failed', '{n} 条失败', '{n} échecs'],
  ['marketing.progress.current', 'Now: {name}', '当前：{name}', 'En cours : {name}'],
  ['marketing.progress.eta', 'Remaining {text}', '剩余 {text}', 'Restant {text}'],
  ['marketing.progress.rate', '{n} / min', '{n} 条/分钟', '{n} / min'],
  ['marketing.progress.pause', 'Pause', '暂停', 'Pause'],
  ['marketing.progress.resume', 'Resume', '继续', 'Reprendre'],
  ['marketing.progress.cancel', 'Stop', '停止', 'Arrêter'],
  ['marketing.progress.close', 'Close', '关闭', 'Fermer'],
  ['marketing.progress.finished', 'Batch complete: {sent} sent, {failed} failed.', '批量发送完成：成功 {sent} 条，失败 {failed} 条。', 'Lot terminé : {sent} envoyés, {failed} échecs.'],
  ['marketing.progress.cancelled', 'Stopped with {skipped} messages not attempted.', '已停止，{skipped} 条未尝试发送。', 'Arrêté, {skipped} messages non tentés.'],
  ['marketing.progress.retryFailed', 'Retry failed', '重试失败项', 'Réessayer les échecs'],
  ['marketing.progress.noFailures', 'No failures to retry.', '没有需要重试的失败项。', 'Aucun échec à réessayer.'],
  ['marketing.progress.failureReason', 'Reason', '失败原因', 'Motif'],

  /* ---------------------------------------------------------------- detail */
  ['marketing.detail.title', 'Campaign', '活动详情', 'Campagne'],
  ['marketing.detail.notFound', 'Campaign not found.', '未找到该活动。', 'Campagne introuvable.'],
  ['marketing.detail.statsTitle', 'Performance', '效果数据', 'Performance'],
  ['marketing.detail.recordsTitle', 'Delivery records', '发送明细', 'Détail des envois'],
  ['marketing.detail.recordsEmpty', 'Nothing delivered yet.', '暂无发送记录。', 'Aucun envoi pour l’instant.'],
  ['marketing.detail.delivered', 'Delivered', '送达', 'Délivrés'],
  ['marketing.detail.opened', 'Opened', '打开', 'Ouverts'],
  ['marketing.detail.clicked', 'Clicked', '点击', 'Cliqués'],
  ['marketing.detail.replied', 'Replied', '回复', 'Réponses'],
  ['marketing.detail.converted', 'Converted', '转化', 'Conversions'],
  ['marketing.detail.openRate', 'Open rate', '打开率', 'Taux d’ouverture'],
  ['marketing.detail.clickRate', 'Click rate', '点击率', 'Taux de clic'],
  ['marketing.detail.replyRate', 'Reply rate', '回复率', 'Taux de réponse'],
  ['marketing.detail.conversionRate', 'Conversion rate', '转化率', 'Taux de conversion'],
  ['marketing.detail.refresh', 'Refresh', '刷新', 'Actualiser'],
  ['marketing.detail.backToList', 'All campaigns', '全部活动', 'Toutes les campagnes'],
  ['marketing.detail.rate', '{n} / min', '{n} 条/分钟', '{n} / min'],

  /* ------------------------------------------------------------- templates */
  ['marketing.templates.title', 'Templates', '文案模板', 'Modèles'],
  ['marketing.templates.subtitle', 'Reusable starting points, grouped by goal.', '可复用的文案起点，按目标分组。', 'Bases réutilisables, classées par objectif.'],
  ['marketing.templates.new', 'New template', '新建模板', 'Nouveau modèle'],
  ['marketing.templates.edit', 'Edit', '编辑', 'Modifier'],
  ['marketing.templates.delete', 'Delete', '删除', 'Supprimer'],
  ['marketing.templates.use', 'Use', '使用', 'Utiliser'],
  ['marketing.templates.searchPlaceholder', 'Search templates', '搜索模板', 'Rechercher un modèle'],
  ['marketing.templates.count', '{n} templates', '共 {n} 个模板', '{n} modèles'],
  ['marketing.templates.categoryAll', 'All goals', '全部目标', 'Tous les objectifs'],
  ['marketing.templates.name', 'Template name', '模板名称', 'Nom du modèle'],
  ['marketing.templates.category', 'Goal', '目标', 'Objectif'],
  ['marketing.templates.bodyTitle', 'Title', '标题', 'Titre'],
  ['marketing.templates.body', 'Body', '正文', 'Corps'],
  ['marketing.templates.cta', 'Call to action', '行动号召', 'Appel à l’action'],
  ['marketing.templates.usage', 'Used {n} times', '已使用 {n} 次', 'Utilisé {n} fois'],
  ['marketing.templates.empty', 'No template matches.', '没有匹配的模板。', 'Aucun modèle correspondant.'],
  ['marketing.templates.savedToast', 'Template saved', '模板已保存', 'Modèle enregistré'],
  ['marketing.templates.updatedToast', 'Template updated', '模板已更新', 'Modèle mis à jour'],
  ['marketing.templates.deletedToast', 'Template deleted', '模板已删除', 'Modèle supprimé'],
  ['marketing.templates.appliedToast', 'Template loaded into the editor', '模板已载入编辑器', 'Modèle chargé dans l’éditeur'],
  ['marketing.templates.deleteTitle', 'Delete template', '删除模板', 'Supprimer le modèle'],
  ['marketing.templates.deleteText', 'Delete this template? Campaigns already sent keep their copy.', '确定删除该模板？已发送的活动文案不受影响。', 'Supprimer ce modèle ? Les campagnes déjà envoyées conservent leur texte.'],
  ['marketing.templates.limitName', 'Max {n} characters', '最多 {n} 个字符', '{n} caractères maximum'],
  ['marketing.templates.limitBody', 'Max {n} characters', '最多 {n} 个字符', '{n} caractères maximum'],

  /* --------------------------------------------------------------- history */
  ['marketing.history.title', 'Send history', '发送记录', 'Historique d’envoi'],
  ['marketing.history.subtitle', 'Every message the platform attempted, with its outcome.', '平台尝试发送的每条消息及其结果。', 'Chaque message tenté, avec son résultat.'],
  ['marketing.history.from', 'From', '开始日期', 'Du'],
  ['marketing.history.to', 'To', '结束日期', 'Au'],
  ['marketing.history.campaign', 'Campaign', '活动', 'Campagne'],
  ['marketing.history.allCampaigns', 'All campaigns', '全部活动', 'Toutes les campagnes'],
  ['marketing.history.export', 'Export CSV', '导出 CSV', 'Exporter CSV'],
  ['marketing.history.exportedToast', 'Exported {n} rows to {file}', '已导出 {n} 行到 {file}', '{n} lignes exportées dans {file}'],
  ['marketing.history.exportFailedToast', 'Export unavailable in this browser', '当前浏览器不支持导出', 'Export indisponible dans ce navigateur'],
  ['marketing.history.empty', 'No records for this filter.', '当前筛选条件下没有记录。', 'Aucun enregistrement pour ce filtre.'],
  ['marketing.history.reset', 'Reset filters', '重置筛选', 'Réinitialiser'],
  ['marketing.history.total', '{n} records', '{n} 条记录', '{n} enregistrements'],
  ['marketing.history.colRecipient', 'Recipient', '收件人', 'Destinataire'],
  ['marketing.history.colCampaign', 'Campaign', '活动', 'Campagne'],
  ['marketing.history.colChannel', 'Channel', '渠道', 'Canal'],
  ['marketing.history.colStatus', 'Status', '状态', 'Statut'],
  ['marketing.history.colTime', 'Time', '时间', 'Heure'],
  ['marketing.history.status.pending', 'Pending', '待发送', 'En attente'],
  ['marketing.history.status.sent', 'Sent', '已发送', 'Envoyé'],
  ['marketing.history.status.failed', 'Failed', '失败', 'Échec'],

  /* ---------------------------------------------------------------- toasts */
  ['marketing.createdToast', 'Campaign created', '活动已创建', 'Campagne créée'],
  ['marketing.startedToast', 'Campaign started', '活动已开始', 'Campagne démarrée'],
  ['marketing.pausedToast', 'Campaign paused', '活动已暂停', 'Campagne en pause'],
  ['marketing.cancelledToast', 'Campaign cancelled', '活动已取消', 'Campagne annulée'],
  ['marketing.nothingToSend', 'No reachable recipient selected.', '未选择可送达的收件人。', 'Aucun destinataire joignable sélectionné.'],
  ['marketing.invalidBlocked', '{n} unreachable contacts were skipped.', '已跳过 {n} 位不可送达的联系人。', '{n} contacts injoignables ont été ignorés.'],
  ['marketing.retriedToast', 'Retried {n} failed messages', '已重试 {n} 条失败消息', '{n} messages en échec relancés'],

  /* ---------------------------------------------------------------- errors */
  ['marketing.error.nameRequired', 'Give the campaign a name.', '请填写活动名称。', 'Donnez un nom à la campagne.'],
  ['marketing.error.nameLength', 'Name must be 2-60 characters.', '名称需为 2-60 个字符。', 'Le nom doit contenir 2 à 60 caractères.'],
  ['marketing.error.contentRequired', 'Generate or write the message first.', '请先生成或填写消息内容。', 'Générez ou rédigez d’abord le message.'],
  ['marketing.error.recipientsRequired', 'Select at least one recipient.', '请至少选择一位收件人。', 'Sélectionnez au moins un destinataire.'],
  ['marketing.error.channelsRequired', 'Choose at least one channel.', '请至少选择一个渠道。', 'Choisissez au moins un canal.'],
  ['marketing.error.scheduleRequired', 'Pick a start time.', '请选择开始时间。', 'Choisissez une heure de début.'],
  ['marketing.error.schedulePast', 'The scheduled time is already in the past.', '定时时间已过期。', 'L’heure planifiée est déjà passée.'],
  ['marketing.error.rateRange', 'Per-minute rate must be 1-60.', '每分钟条数需为 1-60。', 'Le débit doit être entre 1 et 60 par minute.'],
  ['marketing.error.intervalRange', 'Interval must be 1000-60000 ms.', '间隔需为 1000-60000 毫秒。', 'L’intervalle doit être entre 1000 et 60000 ms.'],
  ['marketing.error.templateNameRequired', 'Name the template.', '请填写模板名称。', 'Nommez le modèle.'],
  ['marketing.error.templateNameLength', 'Template name must be 2-40 characters.', '模板名称需为 2-40 个字符。', 'Le nom du modèle doit contenir 2 à 40 caractères.'],
  ['marketing.error.templateTitleRequired', 'Add a message title.', '请填写消息标题。', 'Ajoutez un titre de message.'],
  ['marketing.error.templateTitleTooLong', 'Title must be 120 characters or fewer.', '标题不超过 120 个字符。', 'Le titre ne doit pas dépasser 120 caractères.'],
  ['marketing.error.templateBodyRequired', 'Add the message body.', '请填写消息正文。', 'Ajoutez le corps du message.'],
  ['marketing.error.templateBodyTooLong', 'Body must be 2000 characters or fewer.', '正文不超过 2000 个字符。', 'Le corps ne doit pas dépasser 2000 caractères.']
];

function build(): Record<UiLocale, Record<string, string>> {
  const en: Record<string, string> = {};
  const zh: Record<string, string> = {};
  const fr: Record<string, string> = {};
  for (const row of ROWS) {
    en[row[0]] = row[1];
    zh[row[0]] = row[2];
    fr[row[0]] = row[3];
  }
  return { en, zh, fr };
}

export const marketingMessages: Record<UiLocale, Record<string, string>> = build();

/** Every key this module owns; the parity test compares it against messages.ts. */
export const MARKETING_KEYS: string[] = ROWS.map((row) => row[0]);
