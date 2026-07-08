import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = "https://fygmhpbysovhfgbgrnfu.supabase.co";
const SUPABASE_KEY = "sb_publishable_bOaqVwz0oJVyGTOFx0Zdpg_JnORsbEp";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const state = {
  user: null,
  profile: null,
  friends: [],
  conversations: [],
  messages: [],
  activeConversationId: "",
  messageChannel: null,
  listChannel: null,
  callChannel: null,
  localStream: null,
  peers: new Map(),
  callActive: false,
};

const els = {
  authView: document.querySelector("#authView"),
  appView: document.querySelector("#appView"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authSubmit: document.querySelector("#authSubmit"),
  authToggle: document.querySelector("#authToggle"),
  authError: document.querySelector("#authError"),
  emailInput: document.querySelector("#emailInput"),
  passwordInput: document.querySelector("#passwordInput"),
  usernameInput: document.querySelector("#usernameInput"),
  usernameField: document.querySelector("#usernameField"),
  meName: document.querySelector("#meName"),
  meEmail: document.querySelector("#meEmail"),
  signOutButton: document.querySelector("#signOutButton"),
  friendForm: document.querySelector("#friendForm"),
  friendInput: document.querySelector("#friendInput"),
  friendList: document.querySelector("#friendList"),
  chatList: document.querySelector("#chatList"),
  chatTitle: document.querySelector("#chatTitle"),
  chatSubtitle: document.querySelector("#chatSubtitle"),
  messages: document.querySelector("#messages"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  callButton: document.querySelector("#callButton"),
  callStatus: document.querySelector("#callStatus"),
  groupButton: document.querySelector("#groupButton"),
  groupDialog: document.querySelector("#groupDialog"),
  groupForm: document.querySelector("#groupForm"),
  groupNameInput: document.querySelector("#groupNameInput"),
  groupFriends: document.querySelector("#groupFriends"),
};

let authMode = "signin";

const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

function text(value) {
  return String(value || "").trim();
}

function slug(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
}

function initials(name) {
  return text(name).slice(0, 2).toUpperCase() || "?";
}

function setAuthMode(mode) {
  authMode = mode;
  const signingUp = mode === "signup";
  els.authTitle.textContent = signingUp ? "Create account" : "Welcome back";
  els.authSubmit.textContent = signingUp ? "Sign up" : "Sign in";
  els.authToggle.textContent = signingUp ? "Already have an account? Sign in" : "Need an account? Sign up";
  els.usernameField.hidden = !signingUp;
  els.authError.textContent = "";
}

function showAuth(message = "") {
  els.authView.hidden = false;
  els.appView.hidden = true;
  els.authError.textContent = message;
}

function showApp() {
  els.authView.hidden = true;
  els.appView.hidden = false;
}

function setCallStatus(message, active = false) {
  els.callStatus.textContent = message;
  els.callStatus.classList.toggle("active", active);
  els.callButton.textContent = active ? "Leave voice" : "Voice call";
}

function setChatEnabled(enabled) {
  els.messageInput.disabled = !enabled;
  els.messageForm.querySelector("button").disabled = !enabled;
  els.callButton.disabled = !enabled;
}

async function ensureProfile() {
  const email = state.user.email || "";
  const baseName = email.split("@")[0] || "friend";
  const savedUsername = localStorage.getItem("minicord_signup_username");
  const username = slug(state.user.user_metadata?.username || savedUsername || baseName) || "friend";

  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: state.user.id, username, email }, { onConflict: "id" })
    .select()
    .single();

  if (error) throw error;
  localStorage.removeItem("minicord_signup_username");
  state.profile = data;
}

async function loadFriends() {
  const { data, error } = await supabase
    .from("friendships")
    .select("id, requester_id, receiver_id, requester:profiles!friendships_requester_id_fkey(*), receiver:profiles!friendships_receiver_id_fkey(*)")
    .or(`requester_id.eq.${state.user.id},receiver_id.eq.${state.user.id}`)
    .order("created_at", { ascending: false });

  if (error) throw error;

  state.friends = (data || []).map((row) => {
    const profile = row.requester_id === state.user.id ? row.receiver : row.requester;
    return { friendshipId: row.id, ...profile };
  });
}

async function loadConversations() {
  const { data: memberships, error: memberError } = await supabase
    .from("conversation_members")
    .select("conversation_id")
    .eq("user_id", state.user.id);

  if (memberError) throw memberError;

  const ids = (memberships || []).map((item) => item.conversation_id);
  if (ids.length === 0) {
    state.conversations = [];
    state.activeConversationId = "";
    return;
  }

  const { data, error } = await supabase
    .from("conversations")
    .select("*, members:conversation_members(user_id, profile:profiles(*))")
    .in("id", ids)
    .order("created_at", { ascending: false });

  if (error) throw error;
  state.conversations = data || [];

  if (!state.conversations.some((chat) => chat.id === state.activeConversationId)) {
    state.activeConversationId = state.conversations[0]?.id || "";
  }
}

async function loadMessages() {
  if (!state.activeConversationId) {
    state.messages = [];
    renderMessages();
    return;
  }

  const { data, error } = await supabase
    .from("messages")
    .select("*, profile:profiles(*)")
    .eq("conversation_id", state.activeConversationId)
    .order("created_at", { ascending: true })
    .limit(150);

  if (error) throw error;
  state.messages = data || [];
  renderMessages();
}

function chatName(chat) {
  if (!chat) return "Choose a chat";
  if (chat.name) return chat.name;
  const others = chat.members?.filter((member) => member.user_id !== state.user.id).map((member) => member.profile?.username) || [];
  return others.join(", ") || "Direct message";
}

function chatSubtitle(chat) {
  if (!chat) return "Add a friend or create a group to begin.";
  const count = chat.members?.length || 0;
  return `${count} member${count === 1 ? "" : "s"}`;
}

function renderMe() {
  els.meName.textContent = state.profile?.username || "User";
  els.meEmail.textContent = state.profile?.email || "";
}

function renderFriends() {
  els.friendList.replaceChildren();
  if (state.friends.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No friends yet.";
    els.friendList.append(empty);
    return;
  }

  for (const friend of state.friends) {
    const row = document.createElement("button");
    row.className = "person-row";
    row.innerHTML = `<span class="avatar">${initials(friend.username)}</span><span><strong></strong><small></small></span>`;
    row.querySelector("strong").textContent = friend.username;
    row.querySelector("small").textContent = friend.email;
    row.addEventListener("click", () => openDm(friend));
    els.friendList.append(row);
  }
}

function renderChats() {
  els.chatList.replaceChildren();
  if (state.conversations.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "No chats yet.";
    els.chatList.append(empty);
    return;
  }

  for (const chat of state.conversations) {
    const button = document.createElement("button");
    button.className = "chat-row";
    button.classList.toggle("active", chat.id === state.activeConversationId);
    button.innerHTML = `<span class="avatar">${initials(chatName(chat))}</span><span><strong></strong><small></small></span>`;
    button.querySelector("strong").textContent = chatName(chat);
    button.querySelector("small").textContent = chatSubtitle(chat);
    button.addEventListener("click", () => selectConversation(chat.id));
    els.chatList.append(button);
  }
}

function renderHeader() {
  const chat = state.conversations.find((item) => item.id === state.activeConversationId);
  els.chatTitle.textContent = chatName(chat);
  els.chatSubtitle.textContent = chatSubtitle(chat);
  setChatEnabled(Boolean(chat));
}

function renderMessages() {
  els.messages.replaceChildren();

  if (!state.activeConversationId) {
    const empty = document.createElement("section");
    empty.className = "empty-state";
    empty.innerHTML = "<h2>No chat selected</h2><p>Add a friend, open a DM, or create a group.</p>";
    els.messages.append(empty);
    return;
  }

  if (state.messages.length === 0) {
    const empty = document.createElement("section");
    empty.className = "empty-state";
    empty.innerHTML = "<h2>Start the chat</h2><p>Send the first message.</p>";
    els.messages.append(empty);
    return;
  }

  for (const message of state.messages) {
    const row = document.createElement("article");
    row.className = "message";
    const mine = message.sender_id === state.user.id;
    row.classList.toggle("mine", mine);

    const author = message.profile?.username || "User";
    row.innerHTML = `
      <span class="avatar">${initials(author)}</span>
      <div class="bubble">
        <div class="message-meta"><strong></strong><small></small></div>
        <p></p>
      </div>
    `;
    row.querySelector("strong").textContent = mine ? "You" : author;
    row.querySelector("small").textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    row.querySelector("p").textContent = message.body;
    els.messages.append(row);
  }

  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderGroupFriends() {
  els.groupFriends.replaceChildren();
  for (const friend of state.friends) {
    const label = document.createElement("label");
    label.className = "check-row";
    label.innerHTML = `<input type="checkbox" value="${friend.id}" /><span>${friend.username}</span>`;
    els.groupFriends.append(label);
  }
}

async function refreshAll() {
  await loadFriends();
  await loadConversations();
  renderMe();
  renderFriends();
  renderChats();
  renderHeader();
  await loadMessages();
  subscribeToMessages();
}

async function selectConversation(id) {
  await leaveCall();
  state.activeConversationId = id;
  renderChats();
  renderHeader();
  await loadMessages();
  subscribeToMessages();
}

async function findProfile(identifier) {
  const needle = text(identifier).toLowerCase();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`email.eq.${needle},username.eq.${needle}`)
    .neq("id", state.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function addFriend(identifier) {
  const profile = await findProfile(identifier);
  if (!profile) throw new Error("No user found with that username or email.");

  const smaller = [state.user.id, profile.id].sort();
  const { error } = await supabase.from("friendships").upsert(
    {
      requester_id: smaller[0],
      receiver_id: smaller[1],
    },
    { onConflict: "requester_id,receiver_id" },
  );

  if (error) throw error;
  await openDm(profile);
}

async function openDm(friend) {
  const existing = state.conversations.find((chat) => {
    const memberIds = chat.members?.map((member) => member.user_id).sort() || [];
    return chat.type === "dm" && memberIds.length === 2 && memberIds.includes(state.user.id) && memberIds.includes(friend.id);
  });

  if (existing) {
    await selectConversation(existing.id);
    return;
  }

  const { data: conversation, error } = await supabase.from("conversations").insert({ type: "dm" }).select().single();
  if (error) throw error;

  const { error: memberError } = await supabase.from("conversation_members").insert([
    { conversation_id: conversation.id, user_id: state.user.id },
    { conversation_id: conversation.id, user_id: friend.id },
  ]);
  if (memberError) throw memberError;

  state.activeConversationId = conversation.id;
  await refreshAll();
}

async function createGroup(name, memberIds) {
  const members = [...new Set([state.user.id, ...memberIds])];
  if (members.length < 3) throw new Error("Pick at least two friends for a group.");

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({ type: "group", name })
    .select()
    .single();
  if (error) throw error;

  const rows = members.map((userId) => ({ conversation_id: conversation.id, user_id: userId }));
  const { error: memberError } = await supabase.from("conversation_members").insert(rows);
  if (memberError) throw memberError;

  state.activeConversationId = conversation.id;
  await refreshAll();
}

async function sendMessage(body) {
  const content = text(body);
  if (!content || !state.activeConversationId) return;

  const { error } = await supabase.from("messages").insert({
    conversation_id: state.activeConversationId,
    sender_id: state.user.id,
    body: content,
  });

  if (error) throw error;
}

function subscribeToMessages() {
  if (state.messageChannel) supabase.removeChannel(state.messageChannel);
  if (!state.activeConversationId) return;

  state.messageChannel = supabase
    .channel(`chat:${state.activeConversationId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${state.activeConversationId}` },
      async () => {
        await loadMessages();
      },
    )
    .subscribe();
}

function subscribeToLists() {
  if (state.listChannel) supabase.removeChannel(state.listChannel);
  state.listChannel = supabase
    .channel(`lists:${state.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refreshAll)
    .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, refreshAll)
    .subscribe();
}

function createPeer(remoteUserId, polite) {
  const peer = new RTCPeerConnection({ iceServers });
  state.peers.set(remoteUserId, peer);

  for (const track of state.localStream.getTracks()) {
    peer.addTrack(track, state.localStream);
  }

  peer.ontrack = (event) => {
    let audio = document.querySelector(`[data-audio="${remoteUserId}"]`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.dataset.audio = remoteUserId;
      audio.autoplay = true;
      document.body.append(audio);
    }
    audio.srcObject = event.streams[0];
  };

  peer.onicecandidate = (event) => {
    if (event.candidate) {
      sendSignal("ice", remoteUserId, event.candidate);
    }
  };

  peer.onnegotiationneeded = async () => {
    if (!polite) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal("offer", remoteUserId, peer.localDescription);
  };

  return peer;
}

function sendSignal(type, to, payload = {}) {
  if (!state.user) return;
  state.callChannel?.send({
    type: "broadcast",
    event: "signal",
    payload: { type, to, from: state.user.id, profile: state.profile, payload },
  });
}

async function handleSignal(signal) {
  if (signal.to && signal.to !== state.user.id) return;
  if (signal.from === state.user.id) return;
  if (!state.localStream) return;

  let peer = state.peers.get(signal.from);
  if (!peer) {
    peer = createPeer(signal.from, false);
  }

  if (signal.type === "join") {
    sendSignal("hello", signal.from);
  }

  if (signal.type === "hello") {
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    sendSignal("offer", signal.from, peer.localDescription);
  }

  if (signal.type === "offer") {
    await peer.setRemoteDescription(signal.payload);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    sendSignal("answer", signal.from, peer.localDescription);
  }

  if (signal.type === "answer") {
    await peer.setRemoteDescription(signal.payload);
  }

  if (signal.type === "ice") {
    await peer.addIceCandidate(signal.payload);
  }

  if (signal.type === "leave") {
    peer.close();
    state.peers.delete(signal.from);
    document.querySelector(`[data-audio="${signal.from}"]`)?.remove();
  }
}

async function joinCall() {
  if (!state.activeConversationId || state.callActive) return;
  state.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  state.callActive = true;
  setCallStatus("In voice", true);

  state.callChannel = supabase
    .channel(`voice:${state.activeConversationId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload))
    .subscribe((status) => {
      if (status === "SUBSCRIBED") sendSignal("join", null);
    });
}

async function leaveCall() {
  if (!state.callActive && !state.localStream) return;
  if (state.user) sendSignal("leave", null);

  for (const peer of state.peers.values()) peer.close();
  state.peers.clear();

  state.localStream?.getTracks().forEach((track) => track.stop());
  state.localStream = null;
  state.callActive = false;

  document.querySelectorAll("audio[data-audio]").forEach((audio) => audio.remove());

  if (state.callChannel) {
    await supabase.removeChannel(state.callChannel);
    state.callChannel = null;
  }

  setCallStatus("Not in voice", false);
}

els.authToggle.addEventListener("click", () => setAuthMode(authMode === "signin" ? "signup" : "signin"));

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.authError.textContent = "";

  const email = text(els.emailInput.value).toLowerCase();
  const password = els.passwordInput.value;
  const username = slug(els.usernameInput.value);

  try {
    if (authMode === "signup") {
      if (!username) throw new Error("Choose a username.");
      localStorage.setItem("minicord_signup_username", username);
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
      if (error) throw error;
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    els.authError.textContent = error.message;
  }
});

els.signOutButton.addEventListener("click", async () => {
  await leaveCall();
  await supabase.auth.signOut();
});

els.friendForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const value = els.friendInput.value;
  els.friendInput.value = "";
  try {
    await addFriend(value);
  } catch (error) {
    alert(error.message);
  }
});

els.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = els.messageInput.value;
  els.messageInput.value = "";
  try {
    await sendMessage(body);
  } catch (error) {
    els.messageInput.value = body;
    alert(error.message);
  }
});

els.callButton.addEventListener("click", async () => {
  try {
    if (state.callActive) {
      await leaveCall();
    } else {
      await joinCall();
    }
  } catch (error) {
    alert(`Voice failed: ${error.message}`);
    await leaveCall();
  }
});

els.groupButton.addEventListener("click", () => {
  renderGroupFriends();
  els.groupNameInput.value = "";
  els.groupDialog.showModal();
});

els.groupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selected = [...els.groupFriends.querySelectorAll("input:checked")].map((input) => input.value);
  try {
    await createGroup(text(els.groupNameInput.value) || "Group chat", selected);
    els.groupDialog.close();
  } catch (error) {
    alert(error.message);
  }
});

supabase.auth.onAuthStateChange(async (_event, session) => {
  state.user = session?.user || null;
  if (!state.user) {
    await leaveCall();
    state.profile = null;
    showAuth();
    return;
  }

  try {
    showApp();
    await ensureProfile();
    await refreshAll();
    subscribeToLists();
  } catch (error) {
    showAuth(error.message);
  }
});

setAuthMode("signin");
setChatEnabled(false);
setCallStatus("Not in voice", false);
