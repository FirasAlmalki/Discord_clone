import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = "https://fygmhpbysovhfgbgrnfu.supabase.co";
const SUPABASE_KEY = "sb_publishable_bOaqVwz0oJVyGTOFx0Zdpg_JnORsbEp";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  username: localStorage.getItem("minicord_username") || "",
  servers: [],
  channels: [],
  messages: [],
  activeServerId: localStorage.getItem("minicord_server") || "",
  activeChannelId: localStorage.getItem("minicord_channel") || "",
  messageChannel: null,
  listChannel: null,
};

const els = {
  serverList: document.querySelector("#serverList"),
  channelList: document.querySelector("#channelList"),
  messageList: document.querySelector("#messageList"),
  emptyState: document.querySelector("#emptyState"),
  serverName: document.querySelector("#serverName"),
  channelName: document.querySelector("#channelName"),
  connectionStatus: document.querySelector("#connectionStatus"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  currentUsername: document.querySelector("#currentUsername"),
  userAvatar: document.querySelector("#userAvatar"),
  nameDialog: document.querySelector("#nameDialog"),
  nameForm: document.querySelector("#nameForm"),
  nameInput: document.querySelector("#nameInput"),
  serverDialog: document.querySelector("#serverDialog"),
  serverForm: document.querySelector("#serverForm"),
  serverInput: document.querySelector("#serverInput"),
  channelDialog: document.querySelector("#channelDialog"),
  channelForm: document.querySelector("#channelForm"),
  channelInput: document.querySelector("#channelInput"),
  newServerButton: document.querySelector("#newServerButton"),
  newChannelButton: document.querySelector("#newChannelButton"),
  changeNameButton: document.querySelector("#changeNameButton"),
  setupTemplate: document.querySelector("#setupTemplate"),
};

function cleanName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 32);
}

function cleanChannelName(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28);
}

function initials(name) {
  return (name || "?").trim().slice(0, 2).toUpperCase();
}

function setStatus(text, online = false) {
  els.connectionStatus.textContent = text;
  els.connectionStatus.classList.toggle("online", online);
}

function showSetupWarning() {
  els.messageList.replaceChildren(els.setupTemplate.content.cloneNode(true));
  els.emptyState.hidden = true;
  els.messageForm.hidden = true;
  setStatus("Needs setup");
}

function renderUser() {
  els.currentUsername.textContent = state.username || "Guest";
  els.userAvatar.textContent = initials(state.username);
}

function renderServers() {
  els.serverList.replaceChildren(
    ...state.servers.map((server) => {
      const button = document.createElement("button");
      button.className = "server-button";
      button.classList.toggle("active", server.id === state.activeServerId);
      button.textContent = initials(server.name);
      button.title = server.name;
      button.addEventListener("click", () => selectServer(server.id));
      return button;
    }),
  );
}

function renderChannels() {
  els.channelList.replaceChildren(
    ...state.channels.map((channel) => {
      const button = document.createElement("button");
      button.className = "channel-button";
      button.classList.toggle("active", channel.id === state.activeChannelId);
      button.textContent = channel.name;
      button.addEventListener("click", () => selectChannel(channel.id));
      return button;
    }),
  );
}

function renderHeader() {
  const server = state.servers.find((item) => item.id === state.activeServerId);
  const channel = state.channels.find((item) => item.id === state.activeChannelId);
  els.serverName.textContent = server?.name || "MiniCord";
  els.channelName.textContent = channel ? `# ${channel.name}` : "# welcome";
  els.messageInput.placeholder = channel ? `Message #${channel.name}` : "Pick a channel";
  els.messageInput.disabled = !channel;
  els.messageForm.querySelector("button").disabled = !channel;
}

function renderMessages() {
  els.messageList.replaceChildren();
  els.emptyState.hidden = Boolean(state.activeChannelId);
  els.messageForm.hidden = !state.activeChannelId;

  if (!state.activeChannelId) {
    return;
  }

  if (state.messages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "setup-warning";
    empty.innerHTML = "<strong>No messages yet.</strong><span>Say hello and make this room less awkward.</span>";
    els.messageList.append(empty);
    return;
  }

  for (const message of state.messages) {
    const row = document.createElement("article");
    row.className = "message";

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = initials(message.author);

    const body = document.createElement("div");
    body.className = "message-body";

    const meta = document.createElement("div");
    meta.className = "message-meta";

    const author = document.createElement("span");
    author.className = "message-author";
    author.textContent = message.author;

    const time = document.createElement("span");
    time.className = "message-time";
    time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.body;

    meta.append(author, time);
    body.append(meta, text);
    row.append(avatar, body);
    els.messageList.append(row);
  }

  els.messageList.scrollTop = els.messageList.scrollHeight;
}

async function loadServers() {
  const { data, error } = await supabase.from("servers").select("*").order("created_at", { ascending: true });
  if (error) throw error;
  state.servers = data || [];
  if (!state.servers.some((server) => server.id === state.activeServerId)) {
    state.activeServerId = state.servers[0]?.id || "";
  }
  localStorage.setItem("minicord_server", state.activeServerId);
}

async function loadChannels() {
  if (!state.activeServerId) {
    state.channels = [];
    state.activeChannelId = "";
    return;
  }

  const { data, error } = await supabase
    .from("channels")
    .select("*")
    .eq("server_id", state.activeServerId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  state.channels = data || [];
  if (!state.channels.some((channel) => channel.id === state.activeChannelId)) {
    state.activeChannelId = state.channels[0]?.id || "";
  }
  localStorage.setItem("minicord_channel", state.activeChannelId);
}

async function loadMessages() {
  if (!state.activeChannelId) {
    state.messages = [];
    renderMessages();
    return;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("channel_id", state.activeChannelId)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  state.messages = data || [];
  renderMessages();
}

async function refreshLists() {
  await loadServers();
  await loadChannels();
  renderServers();
  renderChannels();
  renderHeader();
}

async function selectServer(serverId) {
  state.activeServerId = serverId;
  state.activeChannelId = "";
  localStorage.setItem("minicord_server", serverId);
  await loadChannels();
  renderServers();
  renderChannels();
  renderHeader();
  await loadMessages();
  subscribeToMessages();
}

async function selectChannel(channelId) {
  state.activeChannelId = channelId;
  localStorage.setItem("minicord_channel", channelId);
  renderChannels();
  renderHeader();
  await loadMessages();
  subscribeToMessages();
}

async function createServer(name) {
  const { data: server, error } = await supabase
    .from("servers")
    .insert({ name, owner_name: state.username })
    .select()
    .single();
  if (error) throw error;

  const { error: channelError } = await supabase.from("channels").insert({ server_id: server.id, name: "general" });
  if (channelError) throw channelError;

  state.activeServerId = server.id;
  state.activeChannelId = "";
  await refreshLists();
  await loadMessages();
  subscribeToMessages();
}

async function createChannel(name) {
  if (!state.activeServerId) return;
  const { data, error } = await supabase
    .from("channels")
    .insert({ server_id: state.activeServerId, name })
    .select()
    .single();
  if (error) throw error;
  state.activeChannelId = data.id;
  await loadChannels();
  renderChannels();
  renderHeader();
  await loadMessages();
  subscribeToMessages();
}

function subscribeToMessages() {
  if (state.messageChannel) {
    supabase.removeChannel(state.messageChannel);
  }

  if (!state.activeChannelId) {
    setStatus("Ready");
    return;
  }

  setStatus("Connecting");
  state.messageChannel = supabase
    .channel(`messages:${state.activeChannelId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${state.activeChannelId}` },
      (payload) => {
        if (!state.messages.some((message) => message.id === payload.new.id)) {
          state.messages.push(payload.new);
          renderMessages();
        }
      },
    )
    .subscribe((status) => setStatus(status === "SUBSCRIBED" ? "Live" : "Connecting", status === "SUBSCRIBED"));
}

function subscribeToLists() {
  state.listChannel = supabase
    .channel("rooms")
    .on("postgres_changes", { event: "*", schema: "public", table: "servers" }, async () => {
      await refreshLists();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, async () => {
      await loadChannels();
      renderChannels();
      renderHeader();
    })
    .subscribe();
}

async function sendMessage(body) {
  if (!state.activeChannelId || !body.trim()) return;
  const { error } = await supabase.from("messages").insert({
    channel_id: state.activeChannelId,
    author: state.username,
    body: body.trim(),
  });
  if (error) throw error;
}

function ensureName() {
  if (state.username) return;
  els.nameInput.value = "";
  els.nameDialog.showModal();
}

els.nameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = cleanName(els.nameInput.value);
  if (!name) return;
  state.username = name;
  localStorage.setItem("minicord_username", name);
  renderUser();
  els.nameDialog.close();
});

els.changeNameButton.addEventListener("click", () => {
  els.nameInput.value = state.username;
  els.nameDialog.showModal();
});

els.newServerButton.addEventListener("click", () => {
  ensureName();
  if (!state.username) return;
  els.serverInput.value = "";
  els.serverDialog.showModal();
});

els.serverForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = cleanName(els.serverInput.value);
  if (!name) return;
  els.serverDialog.close();
  await createServer(name);
});

els.newChannelButton.addEventListener("click", () => {
  if (!state.activeServerId) return;
  els.channelInput.value = "";
  els.channelDialog.showModal();
});

els.channelForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = cleanChannelName(els.channelInput.value);
  if (!name) return;
  els.channelDialog.close();
  await createChannel(name);
});

els.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  ensureName();
  if (!state.username) return;
  const body = els.messageInput.value;
  els.messageInput.value = "";
  try {
    await sendMessage(body);
  } catch (error) {
    els.messageInput.value = body;
    alert(error.message);
  }
});

async function boot() {
  renderUser();
  ensureName();
  try {
    await refreshLists();
    renderMessages();
    await loadMessages();
    subscribeToMessages();
    subscribeToLists();
    setStatus(state.activeChannelId ? "Live" : "Ready", Boolean(state.activeChannelId));
  } catch (error) {
    console.error(error);
    showSetupWarning();
  }
}

boot();
