(function () {
  const DEFAULT_RECORDS_TABLE = 'nexus_module_records';
  const DEFAULT_SEQUENCES_TABLE = 'nexus_module_sequences';
  const DEFAULT_APP_STATE_TABLE = 'nexus_user_app_state';
  let supabaseClientInstance = null;

  function getConfig() {
    const cfg = window.NexusSupabaseConfig && typeof window.NexusSupabaseConfig === 'object'
      ? window.NexusSupabaseConfig
      : {};

    const url = String(
      cfg.url || window.NEXUS_SUPABASE_URL || window.SUPABASE_URL || ''
    ).trim();

    const anonKey = String(
      cfg.anonKey || window.NEXUS_SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY || ''
    ).trim();

    const recordsTable = String(cfg.recordsTable || DEFAULT_RECORDS_TABLE).trim() || DEFAULT_RECORDS_TABLE;
    const sequencesTable = String(cfg.sequencesTable || DEFAULT_SEQUENCES_TABLE).trim() || DEFAULT_SEQUENCES_TABLE;
    const appStateTable = String(cfg.appStateTable || DEFAULT_APP_STATE_TABLE).trim() || DEFAULT_APP_STATE_TABLE;

    return { url, anonKey, recordsTable, sequencesTable, appStateTable };
  }

  function isConfigured() {
    const cfg = getConfig();
    return !!(
      cfg.url &&
      cfg.anonKey &&
      window.supabase &&
      typeof window.supabase.createClient === 'function'
    );
  }

  function getClient() {
    if (!isConfigured()) return null;
    if (!supabaseClientInstance) {
      const cfg = getConfig();
      supabaseClientInstance = window.supabase.createClient(cfg.url, cfg.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true
        }
      });
    }
    return supabaseClientInstance;
  }

  async function getSession() {
    const client = getClient();
    if (!client) return { session: null, error: new Error('Supabase no configurado') };
    const { data, error } = await client.auth.getSession();
    return {
      session: data && data.session ? data.session : null,
      error: error || null
    };
  }

  function onAuthStateChange(callback) {
    const client = getClient();
    if (!client || typeof callback !== 'function') {
      return { unsubscribe: () => {} };
    }
    const { data } = client.auth.onAuthStateChange(callback);
    return data && data.subscription ? data.subscription : { unsubscribe: () => {} };
  }

  async function signUp(payload) {
    const client = getClient();
    if (!client) return { data: null, error: new Error('Supabase no configurado') };
    return client.auth.signUp(payload);
  }

  async function signInWithPassword(credentials) {
    const client = getClient();
    if (!client) return { data: null, error: new Error('Supabase no configurado') };
    return client.auth.signInWithPassword(credentials);
  }

  async function signOut() {
    const client = getClient();
    if (!client) return { error: null };
    return client.auth.signOut();
  }

  function safeObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  async function loadCompleteUserState(userId) {
    const client = getClient();
    const cfg = getConfig();
    const safeUserId = String(userId || '').trim();
    if (!client || !safeUserId) {
      return {
        data: {
          moduleRecords: {},
          sequences: {},
          settings: {},
          activityLog: [],
          dueAlertsState: {},
          notificationsLastReadAt: '',
          lastOpenedModule: ''
        },
        error: null
      };
    }

    const [recordsResp, sequencesResp, appStateResp] = await Promise.all([
      client
        .from(cfg.recordsTable)
        .select('module_id, record_internal_id, seq, record_id, created_label, payload, created_at')
        .eq('user_id', safeUserId)
        .order('module_id', { ascending: true })
        .order('seq', { ascending: true })
        .order('created_at', { ascending: true }),
      client
        .from(cfg.sequencesTable)
        .select('module_id, last_seq')
        .eq('user_id', safeUserId),
      client
        .from(cfg.appStateTable)
        .select('settings, activity_log, due_alerts_state, notifications_last_read_at, last_opened_module')
        .eq('user_id', safeUserId)
        .maybeSingle()
    ]);

    if (recordsResp.error) return { data: null, error: recordsResp.error };
    if (sequencesResp.error) return { data: null, error: sequencesResp.error };
    if (appStateResp.error) return { data: null, error: appStateResp.error };

    const moduleRecords = {};
    safeArray(recordsResp.data).forEach(row => {
      const moduleId = String(row && row.module_id ? row.module_id : '').trim();
      if (!moduleId) return;
      const payload = safeObject(row && row.payload);
      const recordInternalId = String(row && row.record_internal_id ? row.record_internal_id : (payload._id || '')).trim();
      if (!recordInternalId) return;

      const merged = {
        ...payload,
        _id: recordInternalId,
        _seq: Number.isFinite(Number(row && row.seq)) ? Number(row.seq) : (Number(payload._seq) || 0),
        _registroId: String(row && row.record_id ? row.record_id : (payload._registroId || '')).trim(),
        _fechaReg: String(row && row.created_label ? row.created_label : (payload._fechaReg || '')).trim()
      };

      if (!Array.isArray(moduleRecords[moduleId])) moduleRecords[moduleId] = [];
      moduleRecords[moduleId].push(merged);
    });

    const sequences = {};
    safeArray(sequencesResp.data).forEach(row => {
      const moduleId = String(row && row.module_id ? row.module_id : '').trim();
      if (!moduleId) return;
      const seqValue = Number(row && row.last_seq);
      sequences[moduleId] = Number.isFinite(seqValue) ? Math.max(0, Math.floor(seqValue)) : 0;
    });

    const appState = safeObject(appStateResp.data);

    return {
      data: {
        moduleRecords,
        sequences,
        settings: safeObject(appState.settings),
        activityLog: safeArray(appState.activity_log),
        dueAlertsState: safeObject(appState.due_alerts_state),
        notificationsLastReadAt: String(appState.notifications_last_read_at || '').trim(),
        lastOpenedModule: String(appState.last_opened_module || '').trim()
      },
      error: null
    };
  }

  async function saveCompleteUserState(userId, state) {
    const client = getClient();
    const cfg = getConfig();
    const safeUserId = String(userId || '').trim();
    if (!client || !safeUserId) return { error: new Error('No hay cliente o user_id') };

    const safeState = safeObject(state);
    const moduleRecords = safeObject(safeState.moduleRecords);
    const sequences = safeObject(safeState.sequences);
    const settings = safeObject(safeState.settings);
    const activityLog = safeArray(safeState.activityLog);
    const dueAlertsState = safeObject(safeState.dueAlertsState);
    const notificationsLastReadAt = String(safeState.notificationsLastReadAt || '').trim();
    const lastOpenedModule = String(safeState.lastOpenedModule || '').trim();

    const nowIso = new Date().toISOString();

    const recordRows = [];
    const localModuleIdSet = new Set();
    const localRecordIdsByModule = {};
    Object.keys(moduleRecords).forEach(moduleIdRaw => {
      const moduleId = String(moduleIdRaw || '').trim();
      if (!moduleId) return;
      localModuleIdSet.add(moduleId);
      const records = safeArray(moduleRecords[moduleIdRaw]);
      records.forEach(recordRaw => {
        const record = safeObject(recordRaw);
        const recordInternalId = String(record._id || '').trim();
        if (!recordInternalId) return;
        if (!localRecordIdsByModule[moduleId]) localRecordIdsByModule[moduleId] = new Set();
        localRecordIdsByModule[moduleId].add(recordInternalId);
        const seqValue = Number(record._seq);
        recordRows.push({
          user_id: safeUserId,
          module_id: moduleId,
          record_internal_id: recordInternalId,
          seq: Number.isFinite(seqValue) ? Math.max(0, Math.floor(seqValue)) : 0,
          record_id: String(record._registroId || '').trim(),
          created_label: String(record._fechaReg || '').trim(),
          payload: record,
          updated_at: nowIso
        });
      });
    });

    const sequenceRows = [];
    const localSequenceModuleIdSet = new Set();
    Object.keys(sequences).forEach(moduleIdRaw => {
      const moduleId = String(moduleIdRaw || '').trim();
      if (!moduleId) return;
      localSequenceModuleIdSet.add(moduleId);
      const seqValue = Number(sequences[moduleIdRaw]);
      sequenceRows.push({
        user_id: safeUserId,
        module_id: moduleId,
        last_seq: Number.isFinite(seqValue) ? Math.max(0, Math.floor(seqValue)) : 0,
        updated_at: nowIso
      });
    });

    const appStateRow = {
      user_id: safeUserId,
      settings,
      activity_log: activityLog,
      due_alerts_state: dueAlertsState,
      notifications_last_read_at: notificationsLastReadAt,
      last_opened_module: lastOpenedModule,
      updated_at: nowIso
    };

    const { data: remoteRecordRefs, error: remoteRecordRefsError } = await client
      .from(cfg.recordsTable)
      .select('module_id, record_internal_id')
      .eq('user_id', safeUserId);
    if (remoteRecordRefsError) return { error: remoteRecordRefsError };

    if (recordRows.length > 0) {
      const chunkSize = 500;
      for (let start = 0; start < recordRows.length; start += chunkSize) {
        const chunk = recordRows.slice(start, start + chunkSize);
        const { error: upsertChunkError } = await client
          .from(cfg.recordsTable)
          .upsert(chunk, { onConflict: 'user_id,module_id,record_internal_id' });
        if (upsertChunkError) return { error: upsertChunkError };
      }
    }

    const remoteRecordIdsByModule = {};
    safeArray(remoteRecordRefs).forEach(row => {
      const moduleId = String(row && row.module_id ? row.module_id : '').trim();
      const recordInternalId = String(row && row.record_internal_id ? row.record_internal_id : '').trim();
      if (!moduleId || !recordInternalId) return;
      if (!Array.isArray(remoteRecordIdsByModule[moduleId])) remoteRecordIdsByModule[moduleId] = [];
      remoteRecordIdsByModule[moduleId].push(recordInternalId);
    });

    const allRecordModules = new Set([
      ...Object.keys(remoteRecordIdsByModule),
      ...Array.from(localModuleIdSet)
    ]);

    for (const moduleId of allRecordModules) {
      const remoteIds = Array.isArray(remoteRecordIdsByModule[moduleId]) ? remoteRecordIdsByModule[moduleId] : [];
      if (remoteIds.length === 0) continue;
      const localIdSet = localRecordIdsByModule[moduleId] || new Set();

      if (localIdSet.size === 0) {
        const { error: deleteModuleRowsError } = await client
          .from(cfg.recordsTable)
          .delete()
          .eq('user_id', safeUserId)
          .eq('module_id', moduleId);
        if (deleteModuleRowsError) return { error: deleteModuleRowsError };
        continue;
      }

      const staleIds = remoteIds.filter(recordId => !localIdSet.has(recordId));
      if (staleIds.length === 0) continue;

      const deleteChunkSize = 500;
      for (let start = 0; start < staleIds.length; start += deleteChunkSize) {
        const staleChunk = staleIds.slice(start, start + deleteChunkSize);
        const { error: deleteStaleChunkError } = await client
          .from(cfg.recordsTable)
          .delete()
          .eq('user_id', safeUserId)
          .eq('module_id', moduleId)
          .in('record_internal_id', staleChunk);
        if (deleteStaleChunkError) return { error: deleteStaleChunkError };
      }
    }

    const { data: remoteSequenceRefs, error: remoteSequenceRefsError } = await client
      .from(cfg.sequencesTable)
      .select('module_id')
      .eq('user_id', safeUserId);
    if (remoteSequenceRefsError) return { error: remoteSequenceRefsError };

    if (sequenceRows.length > 0) {
      const { error: upsertSeqError } = await client
        .from(cfg.sequencesTable)
        .upsert(sequenceRows, { onConflict: 'user_id,module_id' });
      if (upsertSeqError) return { error: upsertSeqError };
    }

    const remoteSequenceModules = safeArray(remoteSequenceRefs)
      .map(row => String(row && row.module_id ? row.module_id : '').trim())
      .filter(Boolean);
    const staleSequenceModules = remoteSequenceModules.filter(moduleId => !localSequenceModuleIdSet.has(moduleId));

    if (staleSequenceModules.length > 0) {
      const seqDeleteChunkSize = 200;
      for (let start = 0; start < staleSequenceModules.length; start += seqDeleteChunkSize) {
        const moduleChunk = staleSequenceModules.slice(start, start + seqDeleteChunkSize);
        const { error: deleteStaleSequencesError } = await client
          .from(cfg.sequencesTable)
          .delete()
          .eq('user_id', safeUserId)
          .in('module_id', moduleChunk);
        if (deleteStaleSequencesError) return { error: deleteStaleSequencesError };
      }
    }

    const { error: stateError } = await client
      .from(cfg.appStateTable)
      .upsert(appStateRow, { onConflict: 'user_id' });
    if (stateError) return { error: stateError };

    return { error: null };
  }

  window.NexusSupabase = {
    getConfig,
    isConfigured,
    getClient,
    getSession,
    onAuthStateChange,
    signUp,
    signInWithPassword,
    signOut,
    loadCompleteUserState,
    saveCompleteUserState
  };
})();
