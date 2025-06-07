import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart,
  Home,
  PlusCircle,
  User,
  Target,
  CheckCircle,
  X,
  Camera,
  ChevronRight,
  MessageCircle,
  Send,
  Copy,
  UserPlus,
} from "lucide-react";

// Firebase v9 imports
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  getDatabase,
  ref,
  push,
  serverTimestamp,
  onValue,
  get,
  set,
  update,
} from "firebase/database";

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBs4K186QT7MR9MrCC5en4wbErcH6TMHu4",
  authDomain: "naisufuka.firebaseapp.com",
  databaseURL: "https://naisufuka-default-rtdb.firebaseio.com",
  projectId: "naisufuka",
  storageBucket: "naisufuka.appspot.app",
  messagingSenderId: "632446978572",
  appId: "1:632446978572:web:a459e2495d37893dff3c29",
};

// Firebase初期化
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const FukaApp = () => {
  // グローバルスタイルを追加
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slide-up {
        from { transform: translateY(100%); }
        to { transform: translateY(0); }
      }
      
      /* スクロールバーを非表示にする */
      .no-scrollbar::-webkit-scrollbar {
        display: none;
      }
      .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const [currentView, setCurrentView] = useState("landing");
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [posts, setPosts] = useState([]);

  // 認証関連のstate
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // プロフィール設定用のstate
  const [nickname, setNickname] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 新規投稿用のstate
  const [selectedDeclarationId, setSelectedDeclarationId] = useState(null);
  const [postType, setPostType] = useState("宣言");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [content, setContent] = useState("");
  const [scheduledDate, setScheduledDate] = useState("tomorrow");
  const [selectedHour, setSelectedHour] = useState("07");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedImage, setSelectedImage] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // コメント機能用のstate
  const [showComments, setShowComments] = useState({});
  const [commentText, setCommentText] = useState({});

  // 友達機能用のstate
  const [friends, setFriends] = useState([]);
  const [inviteCode, setInviteCode] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inputInviteCode, setInputInviteCode] = useState("");

  // 招待リンク関連のstate
  const [pendingInviteCode, setPendingInviteCode] = useState(null);

  // 通知機能用のstate
  const [notifications, setNotifications] = useState([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [lastNotificationCheck, setLastNotificationCheck] = useState(null);
  const [highlightedPostId, setHighlightedPostId] = useState(null);

  // 負荷カテゴリ
  const categories = [
    { id: 1, name: "英語学習", emoji: "📚" },
    { id: 2, name: "ジム・筋トレ", emoji: "💪" },
    { id: 3, name: "早起き", emoji: "🌅" },
    { id: 4, name: "資格勉強", emoji: "📝" },
    { id: 5, name: "サイドプロジェクト", emoji: "💼" },
    { id: 6, name: "その他の負荷", emoji: "✨" },
  ];

  // URLパラメータから招待コードを取得
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCodeFromUrl = urlParams.get("invite");
    if (inviteCodeFromUrl && inviteCodeFromUrl.length === 6) {
      setPendingInviteCode(inviteCodeFromUrl);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // selectedCategoryの初期値を設定
  useEffect(() => {
    if (!selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0]);
    }
  }, [selectedCategory]);

  // タイムライン画面に戻った時のハイライト解除
  useEffect(() => {
    if (currentView !== "timeline" && highlightedPostId) {
      setHighlightedPostId(null);
    }
  }, [currentView, highlightedPostId]);

  // 招待リンクの自動処理
  useEffect(() => {
    if (pendingInviteCode && currentUser && currentView === "timeline") {
      handlePendingInvite();
    }
  }, [pendingInviteCode, currentUser, currentView]);

  // 通知の時間を正しく解析する関数
  const parseNotificationDate = (notification) => {
    // createdAtが存在しない場合の処理
    if (!notification.createdAt) {
      console.warn("⚠️ createdAtが存在しない通知:", notification.id);

      // 通知IDからタイムスタンプを抽出する試み
      if (notification.id && typeof notification.id === "string") {
        // IDが "type_postId_userId_timestamp_random" 形式の場合
        const idParts = notification.id.split("_");
        if (idParts.length >= 4) {
          const timestamp = parseInt(idParts[3]);
          if (!isNaN(timestamp) && timestamp > 1000000000000) {
            // 2001年以降のタイムスタンプ
            console.log("📅 IDからタイムスタンプを抽出:", new Date(timestamp));
            return new Date(timestamp);
          }
        }
      }

      // それでも取得できない場合は7日前の日付を返す
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      console.log("📅 デフォルトで7日前の日付を使用");
      return sevenDaysAgo;
    }

    // Firebase Timestampの場合
    if (notification.createdAt?.seconds) {
      return new Date(notification.createdAt.seconds * 1000);
    }

    // ISO文字列の場合
    if (typeof notification.createdAt === "string") {
      const date = new Date(notification.createdAt);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // すでにDate型の場合
    if (notification.createdAt instanceof Date) {
      return notification.createdAt;
    }

    // 数値（タイムスタンプ）の場合
    if (typeof notification.createdAt === "number") {
      return new Date(notification.createdAt);
    }

    // それ以外の場合は7日前の日付を返す
    console.warn("⚠️ 不明なcreatedAt形式:", notification.createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sevenDaysAgo;
  };

  // 時間表示のヘルパー関数（修正版）
  const formatNotificationTime = (notification) => {
    const now = new Date();
    const createdDate = parseNotificationDate(notification);

    // 無効な日付の場合
    if (isNaN(createdDate.getTime())) {
      console.error("❌ 無効な日付:", notification.createdAt);
      return "不明";
    }

    const diff = now.getTime() - createdDate.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    // 未来の日付（不正なデータ）の場合
    if (diff < 0) {
      console.warn("⚠️ 未来の日付が検出されました:", createdDate);
      return "不明";
    }

    // 7日以上前の場合は日付を表示
    if (days >= 7) {
      return createdDate.toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      });
    }

    if (days > 0) return `${days}日前`;
    if (hours > 0) return `${hours}時間前`;
    if (minutes > 0) return `${minutes}分前`;
    return "今";
  };

  // 通知をFirebaseから読み込み（修正版）
  useEffect(() => {
    if (!currentUser) return;

    console.log("🔄 通知リスナー開始 - ユーザー:", currentUser.id);

    const notificationsRef = ref(database, `notifications/${currentUser.id}`);
    const unsubscribe = onValue(notificationsRef, (snapshot) => {
      const data = snapshot.val();
      console.log("📥 Firebase通知データ受信:", data);

      if (data) {
        const notificationsArray = Object.entries(data).map(([key, value]) => {
          // キーの正規化（数値型キーも含めて対応）
          const normalizedKey = key.replace(/[.#$[\]]/g, "_");

          // 日付を正しく解析
          const createdAtDate = parseNotificationDate(value);

          const notification = {
            id: value.originalId || key, // 元のIDを保持
            firebaseKey: normalizedKey, // Firebase用の安全なキー
            ...value,
            createdAt: createdAtDate,
            read: value.read === true, // 明示的にbooleanに変換
          };

          console.log("📨 通知処理:", {
            originalKey: key,
            normalizedKey: normalizedKey,
            id: notification.id,
            read: notification.read,
            type: notification.type,
            fromUserName: notification.fromUserName,
            createdAt: createdAtDate.toISOString(),
          });

          return notification;
        });

        // 新しい順（降順）にソート
        notificationsArray.sort((a, b) => {
          return b.createdAt.getTime() - a.createdAt.getTime();
        });

        // 既存の未読数を保持（重要：既読処理中の場合）
        const currentUnreadCount = unreadNotificationCount;

        setNotifications(notificationsArray);

        // 未読数を正確に計算
        const firebaseUnreadCount = notificationsArray.filter(
          (notif) => notif.read !== true
        ).length;

        console.log("📊 未読数計算:", {
          currentLocalCount: currentUnreadCount,
          firebaseUnreadCount: firebaseUnreadCount,
          willUpdate: Math.abs(currentUnreadCount - firebaseUnreadCount) > 1, // 大きな差がある場合のみ更新
        });

        // 大きな不整合がある場合のみ未読数を更新（小さな一時的な不整合は無視）
        if (Math.abs(currentUnreadCount - firebaseUnreadCount) > 1) {
          console.log(
            "🔄 未読数を大幅修正:",
            currentUnreadCount,
            "→",
            firebaseUnreadCount
          );
          setUnreadNotificationCount(firebaseUnreadCount);
        }
      } else {
        console.log("📭 通知データなし");
        setNotifications([]);
        setUnreadNotificationCount(0);
      }
    });

    return () => {
      console.log("🛑 通知リスナー停止");
      unsubscribe();
    };
  }, [currentUser]); // unreadNotificationCountを依存配列から除外

  // Firebaseからデータを取得（友達の投稿のみ）
  useEffect(() => {
    if (currentUser && friends.length >= 0) {
      const postsRef = ref(database, "posts");
      const unsubscribe = onValue(postsRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const allowedUserIds = [currentUser.id, ...friends];
          const postsArray = Object.entries(data)
            .filter(([, post]) => allowedUserIds.includes(post.userId))
            .map(([key, value]) => {
              // 古いデータ形式を新しい形式に変換
              let normalizedPost = {
                id: key,
                ...value,
              };

              // 古い reactions フィールドを新しい形式に変換
              if (
                value.reactions !== undefined &&
                value.reactionsCount === undefined
              ) {
                normalizedPost.reactionsCount = value.reactions || 0;
                normalizedPost.reactionsList =
                  normalizedPost.reactionsList || [];
              }

              // デフォルト値を設定
              if (normalizedPost.reactionsCount === undefined) {
                normalizedPost.reactionsCount = 0;
              }
              if (normalizedPost.reactionsList === undefined) {
                normalizedPost.reactionsList = [];
              }

              return normalizedPost;
            });

          postsArray.sort((a, b) => {
            const dateA = a.createdAt?.seconds
              ? new Date(a.createdAt.seconds * 1000)
              : new Date(a.createdAt);
            const dateB = b.createdAt?.seconds
              ? new Date(b.createdAt.seconds * 1000)
              : new Date(b.createdAt);
            return dateB - dateA;
          });

          setPosts(postsArray);
        } else {
          setPosts([]);
        }
      });

      return () => unsubscribe();
    }
  }, [currentUser, friends]);

  // 友達リストが変更されたときに読み込み
  useEffect(() => {
    if (currentUser && friends.length === 0 && currentView === "timeline") {
      loadFriends();
    }
  }, [currentUser, currentView]);

  // Firebase認証状態の監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          id: user.uid,
          email: user.email,
          name: "読み込み中...",
        });
        loadUserData(user.uid);
      } else {
        // ログアウト時は完全に状態をクリア
        setCurrentUser(null);
        setFriends([]);
        setPosts([]);
        setInviteCode("");
        setNotifications([]);
        setUnreadNotificationCount(0);
        setLastNotificationCheck(null);
        setShowComments({});
        setCommentText({});
        setHighlightedPostId(null);

        if (
          currentView !== "landing" &&
          currentView !== "tutorial" &&
          currentView !== "login"
        ) {
          setCurrentView("login");
        }
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [currentView]);

  // 保留中の招待処理
  const handlePendingInvite = async () => {
    if (!pendingInviteCode || !currentUser) return;

    try {
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);
      const users = snapshot.val();

      const friendUser = Object.entries(users || {}).find(
        ([userId, userData]) =>
          userData.inviteCode === pendingInviteCode && userId !== currentUser.id
      );

      if (!friendUser) {
        alert("招待リンクが無効です");
        setPendingInviteCode(null);
        return;
      }

      const [friendUserId, friendUserData] = friendUser;

      if (friends.includes(friendUserId)) {
        alert(`${friendUserData.nickname}さんとは既に友達です`);
        setPendingInviteCode(null);
        return;
      }

      const currentUserRef = ref(database, `users/${currentUser.id}/friends`);
      const friendUserRef = ref(database, `users/${friendUserId}/friends`);

      const currentFriends = (await get(currentUserRef)).val() || [];
      await set(currentUserRef, [...currentFriends, friendUserId]);

      const otherFriends = (await get(friendUserRef)).val() || [];
      await set(friendUserRef, [...otherFriends, currentUser.id]);

      alert(`🎉 ${friendUserData.nickname}さんと友達になりました！`);
      setPendingInviteCode(null);
      loadFriends();
    } catch (error) {
      console.error("自動友達追加エラー:", error);
      alert("友達追加に失敗しました");
      setPendingInviteCode(null);
    }
  };

  // 特定の投稿にスクロールする関数
  const scrollToPost = (postId) => {
    setTimeout(() => {
      const postElement = document.getElementById(`post-${postId}`);
      if (postElement) {
        postElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        setHighlightedPostId(postId);
        setTimeout(() => {
          setHighlightedPostId(null);
        }, 3000);
      }
    }, 100);
  };

  // 通知を追加（ID管理改善版）
  const addNotification = async (
    type,
    fromUserId,
    fromUserName,
    postId,
    postContent,
    commentContent = null
  ) => {
    if (!currentUser) return;

    // 投稿者情報を取得
    const post = posts.find((p) => p.id === postId);
    if (!post) {
      console.error("通知作成エラー: 投稿が見つかりません", postId);
      return;
    }

    // 通知の一意IDを生成（Firebase対応版）
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8); // 英数字のみ
    const originalNotificationKey = `${type}_${postId}_${fromUserId}_${timestamp}_${randomId}`;

    // Firebase禁止文字を除去（安全性向上）
    const safeNotificationKey = originalNotificationKey.replace(
      /[.#$[\]]/g,
      "_"
    );

    const newNotification = {
      originalId: originalNotificationKey, // 元のIDを保持
      type,
      fromUserId,
      fromUserName,
      postId,
      postContent:
        postContent.slice(0, 30) + (postContent.length > 30 ? "..." : ""),
      commentContent,
      createdAt: new Date().toISOString(), // ISO文字列として保存
      read: false,
    };

    console.log("📤 新しい通知作成:", {
      originalKey: originalNotificationKey,
      safeKey: safeNotificationKey,
      targetUserId: post.userId,
      data: newNotification,
    });

    try {
      // 投稿者のnotificationsに保存
      const notificationRef = ref(
        database,
        `notifications/${post.userId}/${safeNotificationKey}`
      );
      await set(notificationRef, newNotification);
      console.log("✅ 通知Firebase保存完了");
    } catch (error) {
      console.error("❌ 通知保存エラー:", error);
    }
  };

  // 通知を個別既読にする（既存データ対応版）
  const markNotificationAsRead = async (notificationId) => {
    if (!currentUser || !notificationId) {
      console.error("❌ markNotificationAsRead: 必要なパラメータが不足", {
        currentUser: !!currentUser,
        notificationId,
      });
      return;
    }

    console.log("🔄 個別既読処理開始:", notificationId, typeof notificationId);

    // 対象通知を探す（==で型を無視して比較）
    const targetNotification = notifications.find(
      (n) => n.id == notificationId
    );
    if (!targetNotification) {
      console.error("❌ 対象通知が見つからない:", notificationId);
      console.log(
        "📋 利用可能な通知ID:",
        notifications.map((n) => ({ id: n.id, type: typeof n.id }))
      );
      return;
    }

    if (targetNotification.read === true) {
      console.log("ℹ️ 既に既読済みの通知:", notificationId);
      return;
    }

    console.log("📝 既読対象通知:", {
      id: targetNotification.id,
      firebaseKey: targetNotification.firebaseKey,
      idType: typeof targetNotification.id,
      read: targetNotification.read,
    });

    try {
      let firebaseKey;

      // Firebase用のキーを決定（一括既読と同じロジック）
      if (targetNotification.firebaseKey) {
        // 新しい形式：firebaseKeyが存在する場合
        firebaseKey = targetNotification.firebaseKey;
        console.log(`🔑 新形式のfirebaseKeyを使用: ${firebaseKey}`);
      } else {
        // 古い形式：IDをそのまま使用（数値の場合は文字列に変換）
        if (typeof targetNotification.id === "number") {
          firebaseKey = targetNotification.id.toString().replace(/\./g, "_");
          console.log(
            `🔄 古い数値IDを変換: ${targetNotification.id} → "${firebaseKey}"`
          );
        } else if (typeof targetNotification.id === "string") {
          firebaseKey = targetNotification.id.replace(/[.#$[\]]/g, "_");
          console.log(
            `🔄 古い文字列IDを安全化: ${targetNotification.id} → "${firebaseKey}"`
          );
        } else {
          console.error(
            `⚠️ 無効なID型: ${typeof targetNotification.id}`,
            targetNotification
          );
          return;
        }
      }

      const notificationPath = `notifications/${currentUser.id}/${firebaseKey}`;

      console.log(`🔗 Firebase更新詳細:`, {
        originalId: targetNotification.id,
        firebaseKey: firebaseKey,
        fullPath: notificationPath,
      });

      // Firebaseで既読更新
      const notificationRef = ref(database, notificationPath);
      await update(notificationRef, { read: true });

      console.log("✅ Firebase個別既読更新完了:", targetNotification.id);

      // ローカル状態も即座に更新
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id == notificationId // == で型を無視して比較
            ? { ...notif, read: true }
            : notif
        )
      );

      // 未読数を1減らす
      setUnreadNotificationCount((prev) => {
        const newCount = Math.max(0, prev - 1);
        console.log("📉 個別既読: 未読数更新:", prev, "→", newCount);
        return newCount;
      });
    } catch (error) {
      console.error("❌ 個別既読更新エラー:", error);
      alert("既読処理に失敗しました");
    }
  };

  // 全通知を既読にする（既存データ対応版）
  const markAllNotificationsAsRead = async () => {
    if (!currentUser || notifications.length === 0) {
      console.log("❌ ユーザーまたは通知がありません");
      alert("通知がありません");
      return;
    }

    console.log("🔄 一括既読処理開始");
    console.log("📊 現在の状態:", {
      totalNotifications: notifications.length,
      unreadNotificationCount: unreadNotificationCount,
      notificationsDetail: notifications.map((n) => ({
        id: n.id,
        firebaseKey: n.firebaseKey,
        idType: typeof n.id,
        read: n.read,
        type: n.type,
        fromUserName: n.fromUserName,
      })),
    });

    // 未読通知を詳細に分析
    const unreadNotifications = notifications.filter((n) => n.read !== true);
    const actualUnreadCount = unreadNotifications.length;

    console.log("📊 未読分析:", {
      stateUnreadCount: unreadNotificationCount,
      actualUnreadCount: actualUnreadCount,
      isMatching: unreadNotificationCount === actualUnreadCount,
      unreadList: unreadNotifications.map((n) => ({
        id: n.id,
        firebaseKey: n.firebaseKey,
        idType: typeof n.id,
        read: n.read,
      })),
    });

    if (actualUnreadCount === 0) {
      console.log("ℹ️ 実際に未読通知がありません");

      // 状態の不整合を修正
      if (unreadNotificationCount !== 0) {
        console.log("🔧 未読数の不整合を修正中...");
        setUnreadNotificationCount(0);
        alert("状態を修正しました（既に全て既読です）");
      } else {
        alert("既に全ての通知が既読です");
      }
      return;
    }

    try {
      console.log(
        "📝 既読にする通知一覧:",
        unreadNotifications.map((n) => ({
          id: n.id,
          firebaseKey: n.firebaseKey,
          idType: typeof n.id,
          type: n.type,
          fromUserName: n.fromUserName,
          read: n.read,
        }))
      );

      let successCount = 0;
      let errorCount = 0;

      // 個別に順次更新
      for (let i = 0; i < unreadNotifications.length; i++) {
        const notif = unreadNotifications[i];
        console.log(`📤 通知${i + 1}/${unreadNotifications.length}を処理中:`, {
          id: notif.id,
          firebaseKey: notif.firebaseKey,
          idType: typeof notif.id,
          currentReadStatus: notif.read,
        });

        try {
          let firebaseKey;

          // Firebase用のキーを決定
          if (notif.firebaseKey) {
            // 新しい形式：firebaseKeyが存在する場合
            firebaseKey = notif.firebaseKey;
            console.log(`🔑 新形式のfirebaseKeyを使用: ${firebaseKey}`);
          } else {
            // 古い形式：IDをそのまま使用（数値の場合は文字列に変換）
            if (typeof notif.id === "number") {
              firebaseKey = notif.id.toString().replace(/\./g, "_");
              console.log(
                `🔄 古い数値IDを変換: ${notif.id} → "${firebaseKey}"`
              );
            } else if (typeof notif.id === "string") {
              firebaseKey = notif.id.replace(/[.#$[\]]/g, "_");
              console.log(
                `🔄 古い文字列IDを安全化: ${notif.id} → "${firebaseKey}"`
              );
            } else {
              console.error(`⚠️ 無効なID型: ${typeof notif.id}`, notif);
              errorCount++;
              continue;
            }
          }

          const notificationPath = `notifications/${currentUser.id}/${firebaseKey}`;

          console.log(`🔗 Firebase更新詳細:`, {
            originalId: notif.id,
            firebaseKey: firebaseKey,
            fullPath: notificationPath,
          });

          const notificationRef = ref(database, notificationPath);
          await update(notificationRef, { read: true });

          console.log(
            `✅ 通知${i + 1}更新完了: ${notif.id} (key: ${firebaseKey})`
          );
          successCount++;
        } catch (singleError) {
          console.error(`❌ 通知${i + 1}更新失敗:`, notif.id, singleError);
          errorCount++;
        }
      }

      console.log("📊 処理結果:", {
        成功: successCount,
        失敗: errorCount,
        合計: unreadNotifications.length,
      });

      if (successCount > 0) {
        // ローカル状態を即座に更新
        setNotifications((prev) =>
          prev.map((notif) => ({ ...notif, read: true }))
        );
        setUnreadNotificationCount(0);

        console.log("📉 ローカル状態更新完了 - 未読数を0に設定");
        alert(
          `${successCount}件の通知を既読にしました${
            errorCount > 0 ? ` (${errorCount}件失敗)` : ""
          }`
        );
      } else {
        alert("通知の既読処理に失敗しました");
      }
    } catch (error) {
      console.error("❌ 一括既読処理でエラー発生:", error);
      alert(`既読処理でエラーが発生しました: ${error.message}`);
    }
  };

  // ユーザーデータ読み込み
  const loadUserData = async (userId) => {
    try {
      const userRef = ref(database, `users/${userId}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const userData = snapshot.val();

        setCurrentUser((prev) => ({
          ...prev,
          name: userData.nickname || prev.email?.split("@")[0] || "ユーザー",
          profileData: userData,
        }));
        setInviteCode(userData.inviteCode);
        setFriends(userData.friends || []);

        if (
          currentView === "landing" ||
          currentView === "login" ||
          currentView === "tutorial"
        ) {
          setCurrentView("timeline");
        }
      } else {
        if (
          currentView === "landing" ||
          currentView === "login" ||
          currentView === "tutorial"
        ) {
          setCurrentView("profile-setup");
        }
      }
    } catch (error) {
      console.error("ユーザーデータ読み込みエラー:", error);
      setCurrentUser((prev) => ({
        ...prev,
        name: prev.email?.split("@")[0] || "ユーザー",
      }));
    }
  };

  // 新規登録
  const handleSignup = async () => {
    setAuthError("");

    if (!email.trim()) {
      setAuthError("メールアドレスを入力してください");
      return;
    }

    if (!password.trim()) {
      setAuthError("パスワードを入力してください");
      return;
    }

    if (password !== confirmPassword) {
      setAuthError("パスワードが一致しません");
      return;
    }

    if (password.length < 6) {
      setAuthError("パスワードは6文字以上で入力してください");
      return;
    }

    setIsLoading(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Signup error:", error);
      switch (error.code) {
        case "auth/email-already-in-use":
          setAuthError("このメールアドレスは既に使用されています");
          break;
        case "auth/invalid-email":
          setAuthError("メールアドレスの形式が正しくありません");
          break;
        case "auth/weak-password":
          setAuthError("パスワードが弱すぎます");
          break;
        case "auth/operation-not-allowed":
          setAuthError(
            "現在新規登録は一時的に無効です。管理者にお問い合わせください。"
          );
          break;
        default:
          setAuthError(`新規登録に失敗しました: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ログイン
  const handleLogin = async () => {
    setAuthError("");

    if (!email.trim()) {
      setAuthError("メールアドレスを入力してください");
      return;
    }

    if (!password.trim()) {
      setAuthError("パスワードを入力してください");
      return;
    }

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Login error:", error);
      switch (error.code) {
        case "auth/user-not-found":
        case "auth/wrong-password":
          setAuthError("メールアドレスまたはパスワードが正しくありません");
          break;
        case "auth/invalid-email":
          setAuthError("メールアドレスの形式が正しくありません");
          break;
        case "auth/too-many-requests":
          setAuthError(
            "ログイン試行回数が多すぎます。しばらく待ってから再試行してください"
          );
          break;
        default:
          setAuthError(`ログインに失敗しました: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ログアウト
  const handleLogout = async () => {
    try {
      await signOut(auth);

      // 全ての状態をクリア
      setFriends([]);
      setPosts([]);
      setInviteCode("");
      setNotifications([]);
      setUnreadNotificationCount(0);
      setLastNotificationCheck(null);

      // 画面状態もクリア
      setCurrentView("login");
      setShowComments({});
      setCommentText({});
      setHighlightedPostId(null);

      // localStorage の通知関連データを完全にクリア
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("reactions_") ||
          key.startsWith("comments_") ||
          key.startsWith("notifications_")
        ) {
          localStorage.removeItem(key);
        }
      });

      // 全てのlocalStorageをクリア（安全のため）
      localStorage.clear();
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  };

  const handleNicknameSetup = async (nickname) => {
    try {
      const generateInviteCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      };

      const userInviteCode = generateInviteCode();

      const userRef = ref(database, `users/${currentUser.id}`);
      await set(userRef, {
        nickname: nickname,
        email: currentUser.email,
        inviteCode: userInviteCode,
        friends: [],
        createdAt: serverTimestamp(),
      });

      setCurrentUser({
        ...currentUser,
        name: nickname,
      });

      setInviteCode(userInviteCode);

      if (pendingInviteCode) {
        setCurrentView("timeline");
      } else {
        setCurrentView("invite");
      }
    } catch (error) {
      console.error("ニックネーム設定エラー:", error);
      alert("ニックネーム設定に失敗しました");
    }
  };

  // 招待リンク生成
  const generateInviteLink = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}?invite=${inviteCode}`;
  };

  // 招待リンクをコピー
  const copyInviteLink = () => {
    const inviteLink = generateInviteLink();
    const inviteMessage = `最近どう？負荷かかってる？

${currentUser.name}さんからナイス負荷(β版)の招待が来ています！
${inviteLink}

#ナイス負荷`;

    navigator.clipboard.writeText(inviteMessage);
    alert(
      "招待メッセージをコピーしました！\nLINEやメールで友達にシェアしてください🎉"
    );
  };

  // 友達追加処理
  const addFriend = async (friendInviteCode) => {
    try {
      const usersRef = ref(database, "users");
      const snapshot = await get(usersRef);
      const users = snapshot.val();

      const friendUser = Object.entries(users || {}).find(
        ([userId, userData]) =>
          userData.inviteCode === friendInviteCode && userId !== currentUser.id
      );

      if (!friendUser) {
        alert("招待コードが見つかりません");
        return;
      }

      const [friendUserId, friendUserData] = friendUser;

      if (friends.includes(friendUserId)) {
        alert("既に友達です");
        return;
      }

      const currentUserRef = ref(database, `users/${currentUser.id}/friends`);
      const friendUserRef = ref(database, `users/${friendUserId}/friends`);

      const currentFriends = (await get(currentUserRef)).val() || [];
      await set(currentUserRef, [...currentFriends, friendUserId]);

      const otherFriends = (await get(friendUserRef)).val() || [];
      await set(friendUserRef, [...otherFriends, currentUser.id]);

      alert(`${friendUserData.nickname}さんと友達になりました！`);
      setInputInviteCode("");
      setShowInviteModal(false);

      loadFriends();
    } catch (error) {
      console.error("友達追加エラー:", error);
      alert("友達追加に失敗しました");
    }
  };

  // 友達リスト読み込み
  const loadFriends = async () => {
    try {
      const userRef = ref(database, `users/${currentUser.id}/friends`);
      const snapshot = await get(userRef);
      const friendIds = snapshot.val() || [];
      setFriends(friendIds);
    } catch (error) {
      console.error("友達リスト読み込みエラー:", error);
    }
  };

  const addReaction = async (postId) => {
    try {
      // 投稿情報を取得
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        console.error("投稿が見つかりません:", postId);
        return;
      }

      // 既存のリアクションリストを取得
      const reactionsListRef = ref(database, `posts/${postId}/reactionsList`);
      const listSnapshot = await get(reactionsListRef);
      const currentList = listSnapshot.val() || [];

      // 既にリアクションしていない場合のみ追加
      const alreadyReacted = currentList.some(
        (reaction) => reaction.userId === currentUser.id
      );
      if (!alreadyReacted) {
        const newReaction = {
          userId: currentUser.id,
          userName: currentUser.name,
          createdAt: serverTimestamp(),
        };
        const updatedList = [...currentList, newReaction];
        await set(reactionsListRef, updatedList);

        // リアクション数も更新
        const reactionsCountRef = ref(
          database,
          `posts/${postId}/reactionsCount`
        );
        await set(reactionsCountRef, updatedList.length);

        // 古いreactionsフィールドとの互換性のため
        const oldReactionsRef = ref(database, `posts/${postId}/reactions`);
        await set(oldReactionsRef, updatedList.length);

        // 投稿者が自分でない場合のみ通知を作成
        if (post.userId !== currentUser.id) {
          console.log("🔔 リアクション通知を作成します:", {
            postId: postId,
            postUserId: post.userId,
            fromUserId: currentUser.id,
            fromUserName: currentUser.name,
          });

          await addNotification(
            "reaction",
            currentUser.id,
            currentUser.name,
            postId,
            post.content
          );
        }
      }
    } catch (error) {
      console.error("リアクションエラー:", error);
    }
  };

  const addComment = async (postId) => {
    const comment = commentText[postId]?.trim();
    if (!comment) return;

    try {
      // 投稿情報を取得
      const post = posts.find((p) => p.id === postId);
      if (!post) {
        console.error("投稿が見つかりません:", postId);
        return;
      }

      const commentData = {
        userId: currentUser.id,
        userName: currentUser.name,
        content: comment,
        createdAt: serverTimestamp(),
      };

      await push(ref(database, `posts/${postId}/comments`), commentData);

      setCommentText((prev) => ({
        ...prev,
        [postId]: "",
      }));

      // 投稿者が自分でない場合のみ通知を作成
      if (post.userId !== currentUser.id) {
        console.log("🔔 コメント通知を作成します:", {
          postId: postId,
          postUserId: post.userId,
          fromUserId: currentUser.id,
          fromUserName: currentUser.name,
          commentContent: comment,
        });

        await addNotification(
          "comment",
          currentUser.id,
          currentUser.name,
          postId,
          post.content,
          comment
        );
      }
    } catch (error) {
      console.error("コメントエラー:", error);
    }
  };

  const toggleComments = (postId) => {
    setShowComments((prev) => ({
      ...prev,
      [postId]: !prev[postId],
    }));
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const createPost = async (postData) => {
    const newPost = {
      userId: currentUser.id,
      userName: currentUser.name,
      ...postData,
      reactionsCount: 0,
      reactionsList: [],
      createdAt: serverTimestamp(),
      declarationId: postData.declarationId || null,
    };

    try {
      await push(ref(database, "posts"), newPost);

      setContent("");
      setPostType("宣言");
      setScheduledDate("tomorrow");
      setSelectedHour("07");
      setSelectedMinute("00");
      setSelectedImage(null);
      setSelectedDeclarationId(null);

      setCurrentView("timeline");
    } catch (error) {
      console.error("投稿エラー:", error);
      alert("投稿に失敗しました");
    }
  };

  // 時間ピッカーコンポーネント
  const TimePicker = () => {
    const hours = Array.from({ length: 24 }, (_, i) =>
      i.toString().padStart(2, "0")
    );
    const minutes = Array.from({ length: 60 }, (_, i) =>
      i.toString().padStart(2, "0")
    );

    const generateDates = () => {
      const dates = [];
      const today = new Date();
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        dates.push(date);
      }
      return dates;
    };

    const dates = generateDates();
    const dateObserverRef = useRef(null);
    const hourObserverRef = useRef(null);
    const minuteObserverRef = useRef(null);
    const dateScrollRef = useRef(null);
    const hourScrollRef = useRef(null);
    const minuteScrollRef = useRef(null);

    const ITEM_HEIGHT = 50;
    const CONTAINER_HEIGHT = 200;
    const CENTER_OFFSET = (CONTAINER_HEIGHT - ITEM_HEIGHT) / 2;

    const getCurrentDateIndex = () => {
      return scheduledDate === "today" ? 0 : 1;
    };

    const [selectedDateIndex, setSelectedDateIndex] = useState(
      getCurrentDateIndex()
    );

    const setupIntersectionObserver = useCallback(
      (container, items, setter, type) => {
        if (!container) return;

        let updateTimeout;

        const observer = new IntersectionObserver(
          (entries) => {
            clearTimeout(updateTimeout);
            updateTimeout = setTimeout(() => {
              const relevantEntries = entries.filter(
                (entry) =>
                  entry.target.dataset.type === type && entry.isIntersecting
              );

              if (relevantEntries.length === 0) return;

              let mostVisible = null;
              let minDistance = Infinity;

              relevantEntries.forEach((entry) => {
                const rect = entry.boundingClientRect;
                const containerRect = container.getBoundingClientRect();

                const centerY = containerRect.top + containerRect.height / 2;
                const itemCenterY = rect.top + rect.height / 2;
                const distance = Math.abs(centerY - itemCenterY);

                if (distance < minDistance) {
                  minDistance = distance;
                  mostVisible = entry.target;
                }
              });

              if (mostVisible) {
                const index = parseInt(mostVisible.dataset.index);

                switch (type) {
                  case "date":
                    setter(index);
                    break;
                  case "hour":
                    setter(hours[index]);
                    break;
                  case "minute":
                    setter(minutes[index]);
                    break;
                }
              }
            }, 50);
          },
          {
            root: container,
            rootMargin: `-${CENTER_OFFSET}px 0px -${CENTER_OFFSET}px 0px`,
            threshold: [0, 0.25, 0.5, 0.75, 1.0],
          }
        );

        items.forEach((item) => {
          if (item && item.dataset.type === type) {
            observer.observe(item);
          }
        });

        return observer;
      },
      [hours, minutes]
    );

    const scrollToInitialPosition = useCallback(() => {
      if (!showTimePicker) return;

      setTimeout(() => {
        if (dateScrollRef.current) {
          const targetPosition = selectedDateIndex * ITEM_HEIGHT;
          dateScrollRef.current.scrollTop = targetPosition;
        }
        if (hourScrollRef.current) {
          const hourIndex = hours.indexOf(selectedHour);
          const targetPosition = hourIndex * ITEM_HEIGHT;
          hourScrollRef.current.scrollTop = targetPosition;
        }
        if (minuteScrollRef.current) {
          const minuteIndex = minutes.indexOf(selectedMinute);
          const targetPosition = minuteIndex * ITEM_HEIGHT;
          minuteScrollRef.current.scrollTop = targetPosition;
        }
      }, 100);
    }, [
      showTimePicker,
      selectedDateIndex,
      selectedHour,
      selectedMinute,
      hours,
      minutes,
    ]);

    useEffect(() => {
      if (!showTimePicker) return;

      const timeouts = [];

      timeouts.push(
        setTimeout(() => {
          const dateItems =
            dateScrollRef.current?.querySelectorAll('[data-type="date"]');
          if (dateItems && dateScrollRef.current) {
            dateObserverRef.current = setupIntersectionObserver(
              dateScrollRef.current,
              Array.from(dateItems),
              setSelectedDateIndex,
              "date"
            );
          }
        }, 100)
      );

      timeouts.push(
        setTimeout(() => {
          const hourItems =
            hourScrollRef.current?.querySelectorAll('[data-type="hour"]');
          if (hourItems && hourScrollRef.current) {
            hourObserverRef.current = setupIntersectionObserver(
              hourScrollRef.current,
              Array.from(hourItems),
              setSelectedHour,
              "hour"
            );
          }
        }, 200)
      );

      timeouts.push(
        setTimeout(() => {
          const minuteItems = minuteScrollRef.current?.querySelectorAll(
            '[data-type="minute"]'
          );
          if (minuteItems && minuteScrollRef.current) {
            minuteObserverRef.current = setupIntersectionObserver(
              minuteScrollRef.current,
              Array.from(minuteItems),
              setSelectedMinute,
              "minute"
            );
          }
        }, 300)
      );

      return () => {
        timeouts.forEach((timeout) => clearTimeout(timeout));
        dateObserverRef.current?.disconnect();
        hourObserverRef.current?.disconnect();
        minuteObserverRef.current?.disconnect();
      };
    }, [showTimePicker, setupIntersectionObserver]);

    useEffect(() => {
      scrollToInitialPosition();
    }, [scrollToInitialPosition]);

    const PickerItem = ({ children, isSelected, dataIndex, dataType }) => (
      <div
        className="flex items-center justify-center transition-all duration-200 ease-out"
        data-index={dataIndex}
        data-type={dataType}
        style={{
          height: `${ITEM_HEIGHT}px`,
          fontSize: isSelected ? "20px" : "16px",
          fontWeight: isSelected ? "700" : "400",
          color: isSelected ? "#000000" : "#999999",
          transform: "translateX(0)",
        }}
      >
        <div className="text-center">{children}</div>
      </div>
    );

    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
        <div
          className="bg-white w-full rounded-t-3xl max-h-[80vh] overflow-hidden"
          style={{
            animation: "slide-up 0.3s ease-out",
          }}
        >
          <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
            <button
              onClick={() => setShowTimePicker(false)}
              className="text-gray-500 font-medium hover:text-gray-700 transition"
            >
              キャンセル
            </button>
            <h3 className="text-lg font-semibold">日時を選択</h3>
            <button
              onClick={() => {
                if (selectedDateIndex === 0) {
                  setScheduledDate("today");
                } else if (selectedDateIndex === 1) {
                  setScheduledDate("tomorrow");
                } else {
                  setScheduledDate(`day-${selectedDateIndex}`);
                }
                setShowTimePicker(false);
              }}
              className="text-blue-600 font-semibold hover:text-blue-700 transition"
            >
              決定
            </button>
          </div>

          <div className="p-6">
            <div className="relative">
              <div
                className="absolute inset-x-0 bg-gradient-to-r from-blue-100 to-purple-100 border border-blue-300 rounded-xl z-10 pointer-events-none"
                style={{
                  top: CENTER_OFFSET + 35,
                  height: ITEM_HEIGHT,
                }}
              />

              <div className="absolute top-0 left-0 right-0 h-16 bg-gradient-to-b from-white to-transparent z-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white to-transparent z-20 pointer-events-none" />

              <div className="grid grid-cols-3 gap-4 relative z-30">
                <div className="col-span-1">
                  <p className="text-sm font-medium text-gray-600 text-center mb-3">
                    日付
                  </p>
                  <div
                    ref={dateScrollRef}
                    className="overflow-y-auto no-scrollbar"
                    style={{
                      height: CONTAINER_HEIGHT,
                      paddingTop: CENTER_OFFSET,
                      paddingBottom: CENTER_OFFSET,
                      isolation: "isolate",
                      WebkitOverflowScrolling: "touch",
                      scrollBehavior: "auto",
                      overflowX: "hidden",
                      contain: "layout style paint",
                      willChange: "scroll-position",
                      transform: "translateZ(0)",
                    }}
                  >
                    {dates.map((date, index) => {
                      const month = date.getMonth() + 1;
                      const day = date.getDate();
                      const dayNames = [
                        "日",
                        "月",
                        "火",
                        "水",
                        "木",
                        "金",
                        "土",
                      ];
                      const dayOfWeek = dayNames[date.getDay()];

                      let label;
                      if (index === 0) label = "今日";
                      else if (index === 1) label = "明日";
                      else label = `${month}月${day}日 ${dayOfWeek}`;

                      return (
                        <PickerItem
                          key={index}
                          isSelected={selectedDateIndex === index}
                          dataIndex={index}
                          dataType="date"
                        >
                          {label}
                        </PickerItem>
                      );
                    })}
                  </div>
                </div>

                <div className="col-span-1">
                  <p className="text-sm font-medium text-gray-600 text-center mb-3">
                    時
                  </p>
                  <div
                    ref={hourScrollRef}
                    className="overflow-y-auto no-scrollbar"
                    style={{
                      height: CONTAINER_HEIGHT,
                      paddingTop: CENTER_OFFSET,
                      paddingBottom: CENTER_OFFSET,
                      isolation: "isolate",
                      WebkitOverflowScrolling: "touch",
                      scrollBehavior: "auto",
                      overflowX: "hidden",
                      contain: "layout style paint",
                      willChange: "scroll-position",
                      transform: "translateZ(0)",
                    }}
                  >
                    {hours.map((hour, index) => (
                      <PickerItem
                        key={hour}
                        isSelected={selectedHour === hour}
                        dataIndex={index}
                        dataType="hour"
                      >
                        {hour}
                      </PickerItem>
                    ))}
                  </div>
                </div>

                <div className="col-span-1">
                  <p className="text-sm font-medium text-gray-600 text-center mb-3">
                    分
                  </p>
                  <div
                    ref={minuteScrollRef}
                    className="overflow-y-auto no-scrollbar"
                    style={{
                      height: CONTAINER_HEIGHT,
                      paddingTop: CENTER_OFFSET,
                      paddingBottom: CENTER_OFFSET,
                      isolation: "isolate",
                      WebkitOverflowScrolling: "touch",
                      scrollBehavior: "auto",
                      overflowX: "hidden",
                      contain: "layout style paint",
                      willChange: "scroll-position",
                      transform: "translateZ(0)",
                    }}
                  >
                    {minutes.map((minute, index) => (
                      <PickerItem
                        key={minute}
                        isSelected={selectedMinute === minute}
                        dataIndex={index}
                        dataType="minute"
                      >
                        {minute}
                      </PickerItem>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // シンプルランディング画面
  if (currentView === "landing") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md text-center">
          <h1 className="text-3xl sm:text-4xl font-black text-black mb-3">
            ナイス負荷<span className="text-[#00d084]">β</span>
          </h1>

          <h2 className="text-xl sm:text-2xl font-bold text-center mb-2 sm:mb-3 text-black leading-tight">
            最近どう？
            <br />
            負荷かかってる？
          </h2>

          <p className="text-gray-600 text-center mb-6 sm:mb-8 text-sm leading-relaxed">
            ナイス負荷βは、個々人の人生に
            <br />
            <span className="text-[#00d084] font-semibold">良質</span>な、
            <span className="text-[#00d084] font-semibold">適度</span>な、
            <span className="text-[#00d084] font-semibold">心地のよい</span>
            負荷をかけることで
            <br />
            理想の未来の実現を
            <br />
            後押しするサービスです。
          </p>

          <button
            onClick={() => setCurrentView("tutorial")}
            className="w-full bg-[#0062ff] text-white py-3 sm:py-4 rounded-xl font-semibold hover:bg-[#0050dd] transition-all hover:shadow-lg transform hover:-translate-y-0.5 text-base sm:text-lg"
          >
            使ってみる
          </button>
        </div>
      </div>
    );
  }

  // チュートリアル画面
  if (currentView === "tutorial") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 p-3 sm:p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl font-black text-black mb-2">
              ナイス負荷<span className="text-[#00d084]">β</span>へようこそ！
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              使い方を簡単にご紹介します
            </p>
          </div>

          <div className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl sm:text-2xl">🎯</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#0062ff]">
                  負荷宣言
                </h3>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-3">
                これから取り組む負荷を宣言しましょう。
                <br className="sm:hidden" />
                「明日の朝7時に英語を勉強する」など、
                <br className="sm:hidden" />
                具体的な時間と内容を投稿します。
              </p>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-700">
                  💡 仲間から「レッツ負荷」で
                  <br className="sm:hidden" />
                  応援がもらえます
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl sm:text-2xl">✅</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-[#00d084]">
                  負荷報告
                </h3>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-3">
                実際に取り組んだ負荷の成果を報告しましょう。
                <br className="sm:hidden" />
                写真を添付して達成を証明できます。
                <br className="sm:hidden" />
                宣言した負荷を達成した場合は、
                <br className="sm:hidden" />
                それも記録されます。
              </p>
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-xs sm:text-sm text-green-700">
                  💚 「ナイス負荷」で
                  <br className="sm:hidden" />
                  達成を称えられます
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl sm:text-2xl">👥</span>
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-purple-600">
                  友達機能
                </h3>
              </div>
              <p className="text-gray-600 text-sm sm:text-base leading-relaxed mb-3">
                信頼できる友達とだけ負荷を共有。
                <br className="sm:hidden" />
                プライベートな環境で安心して
                <br className="sm:hidden" />
                自分の成長を記録できます。
              </p>
              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-xs sm:text-sm text-purple-700">
                  🔒 招待制なので安心・安全
                </p>
              </div>
            </div>
          </div>

          <div className="text-center space-y-4">
            <button
              onClick={() => setCurrentView("login")}
              className="w-full bg-[#0062ff] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:bg-[#0050dd] transition-all hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
            >
              アカウントを作成
            </button>
            <button
              onClick={() => setCurrentView("landing")}
              className="text-gray-500 hover:text-gray-700 transition text-sm"
            >
              ← トップに戻る
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0062ff] mx-auto mb-4"></div>
          <h1 className="text-2xl font-black text-black">
            ナイス負荷<span className="text-[#00d084]">β</span>
          </h1>
          <p className="text-gray-600 mt-2">読み込み中...</p>
        </div>
      </div>
    );
  }

  // ログイン/新規登録画面
  if (currentView === "login") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md">
          <div className="text-center mb-8 sm:mb-10">
            <h1 className="text-3xl sm:text-4xl font-black text-black mb-3">
              ナイス負荷<span className="text-[#00d084]">β</span>
            </h1>
            {pendingInviteCode && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-blue-700 text-sm font-medium">
                  🎉 友達があなたを招待しています！
                  <br />
                  ログインまたは新規登録後、自動的に友達になります
                </p>
              </div>
            )}
          </div>

          <div className="flex mb-6">
            <button
              onClick={() => setAuthMode("login")}
              className={`flex-1 py-2 text-center font-medium transition ${
                authMode === "login"
                  ? "text-[#0062ff] border-b-2 border-[#0062ff]"
                  : "text-gray-500"
              }`}
            >
              ログイン
            </button>
            <button
              onClick={() => setAuthMode("signup")}
              className={`flex-1 py-2 text-center font-medium transition ${
                authMode === "signup"
                  ? "text-[#0062ff] border-b-2 border-[#0062ff]"
                  : "text-gray-500"
              }`}
            >
              新規登録
            </button>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-red-600 text-sm">{authError}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                パスワード
              </label>
              <input
                type="password"
                placeholder="6文字以上で入力"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {authMode === "signup" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  placeholder="パスワードを再入力"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            <button
              onClick={authMode === "login" ? handleLogin : handleSignup}
              disabled={isLoading}
              className="w-full bg-[#0062ff] text-white py-3 rounded-xl font-semibold hover:bg-[#0050dd] transition-all hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? authMode === "login"
                  ? "ログイン中..."
                  : "登録中..."
                : authMode === "login"
                ? "ログイン"
                : "新規登録"}
            </button>

            <div className="text-center space-y-2">
              <button
                onClick={() => setCurrentView("login")}
                className="text-[#0062ff] hover:underline text-sm"
              >
                既にアカウントをお持ちの方はログイン
              </button>
              <br />
              <button
                onClick={() => setCurrentView("tutorial")}
                className="text-gray-500 hover:text-gray-700 transition text-sm"
              >
                ← 使い方を見る
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // プロフィール設定画面
  if (currentView === "profile-setup") {
    const handleSubmit = async () => {
      if (!nickname.trim()) {
        alert("ニックネームを入力してください");
        return;
      }

      if (nickname.trim().length > 10) {
        alert("ニックネームは10文字以内で入力してください");
        return;
      }

      setIsSubmitting(true);
      await handleNicknameSetup(nickname.trim());
      setIsSubmitting(false);
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-10 w-full max-w-md">
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-black text-black mb-2">
              プロフィール設定
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              ようこそ！
              <br className="sm:hidden" />
              あなたのニックネームを
              <br className="sm:hidden" />
              教えてください
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ニックネーム
              </label>
              <input
                type="text"
                placeholder="例：負荷太郎、フカちゃん"
                className="w-full px-3 sm:px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition text-base sm:text-lg"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={10}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleSubmit();
                  }
                }}
              />
              <p className="text-xs text-gray-500 mt-2">
                ※10文字以内・投稿時に表示されます
              </p>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !nickname.trim()}
              className="w-full bg-[#0062ff] text-white py-3 sm:py-4 rounded-xl font-semibold hover:bg-[#0050dd] transition-all hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm sm:text-base"
            >
              {isSubmitting ? "設定中..." : "ナイス負荷を始める！"}
            </button>

            <div className="text-center">
              <p className="text-xs text-gray-500">
                メールアドレス: {currentUser?.email}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 招待画面
  if (currentView === "invite") {
    const copyInviteCode = () => {
      navigator.clipboard.writeText(inviteCode);
      alert("招待コードをコピーしました！");
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-green-50/30 p-3 sm:p-4">
        <div className="max-w-2xl mx-auto">
          <div className="text-center py-6 sm:py-8">
            <h1 className="text-2xl sm:text-3xl font-black text-black mb-2">
              友達を招待しよう！
            </h1>
            <p className="text-gray-600 text-sm sm:text-base">
              友達同士で負荷を共有できます
            </p>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-3 text-center">
                あなたの招待コード
              </h3>
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 text-center">
                <p className="text-3xl sm:text-4xl font-bold text-[#0062ff] mb-2 tracking-wider">
                  {inviteCode}
                </p>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={copyInviteCode}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0062ff] text-white rounded-lg text-sm font-medium hover:bg-[#0050dd] transition"
                  >
                    <Copy size={16} />
                    コード
                  </button>
                  <button
                    onClick={copyInviteLink}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00d084] text-white rounded-lg text-sm font-medium hover:bg-[#00b574] transition"
                  >
                    🔗 メッセージ
                  </button>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-3 text-center">
                6桁のコードを教えるか、リンクをシェアして友達を招待しましょう
              </p>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-3 text-center">友達を追加</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="友達の招待コードを入力"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition text-center text-lg tracking-wider"
                  value={inputInviteCode}
                  onChange={(e) =>
                    setInputInviteCode(
                      e.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                    )
                  }
                  maxLength={6}
                />
                <button
                  onClick={() => addFriend(inputInviteCode)}
                  disabled={inputInviteCode.length !== 6}
                  className="w-full bg-[#00d084] text-white py-3 rounded-xl font-semibold hover:bg-[#00b574] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  友達を追加
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm">
              <h3 className="text-lg font-bold mb-3">
                友達リスト ({friends.length}人)
              </h3>
              {friends.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  まだ友達がいません
                </p>
              ) : (
                <div className="space-y-2">
                  {friends.map((friendId) => (
                    <div
                      key={friendId}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                        ?
                      </div>
                      <span className="text-gray-600">友達</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="text-center">
              <button
                onClick={() => setCurrentView("timeline")}
                className="bg-[#0062ff] text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:bg-[#0050dd] transition-all hover:shadow-lg transform hover:-translate-y-0.5 text-sm sm:text-base"
              >
                タイムラインを見る
              </button>
              <p className="text-xs sm:text-sm text-gray-500 mt-2">
                後から友達を追加することもできます
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 通知画面（修正版）
  if (currentView === "notifications") {
    const handleNotificationClick = async (notification) => {
      const notificationId = notification.id;

      console.log("🔔 通知クリック:", {
        clickedId: notificationId,
        notification: notification,
        currentUnreadCount: unreadNotificationCount,
      });

      // この通知を個別に既読にする
      await markNotificationAsRead(notificationId);

      // 投稿にジャンプ
      const targetPost = posts.find((post) => post.id === notification.postId);
      if (targetPost) {
        setCurrentView("timeline");
        scrollToPost(notification.postId);
      } else {
        setCurrentView("timeline");
        alert("この投稿は削除されているか、表示できません");
      }
    };

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView("timeline")}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight size={24} className="rotate-180" />
              </button>
              <h1 className="text-xl font-bold">通知</h1>
            </div>
            <div className="flex items-center gap-2">
              {unreadNotificationCount > 0 && (
                <>
                  <div className="text-sm text-gray-500">
                    <span>未読 {unreadNotificationCount}件</span>
                  </div>
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="text-[#0062ff] text-sm font-medium hover:underline"
                  >
                    すべて既読
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-400"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
              </div>
              <p className="text-gray-500 mb-2">通知はまだありません</p>
              <p className="text-sm text-gray-400">
                友達からのリアクションやコメントがここに表示されます
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition ${
                    !notification.read ? "bg-blue-50" : "bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.type === "reaction"
                          ? "bg-gradient-to-br from-pink-100 to-red-100"
                          : "bg-gradient-to-br from-blue-100 to-purple-100"
                      }`}
                    >
                      {notification.type === "reaction" ? (
                        <Heart
                          size={20}
                          className="text-pink-600 fill-current"
                        />
                      ) : (
                        <MessageCircle size={20} className="text-blue-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                        )}
                        <p className="font-semibold text-gray-900">
                          {notification.type === "reaction"
                            ? `${notification.fromUserName}さんから${
                                notification.fromUserName.includes(
                                  "レッツ負荷"
                                ) ||
                                notification.fromUserName.includes("ナイス負荷")
                                  ? ""
                                  : "ナイス負荷"
                              }をもらいました！`
                            : `${notification.fromUserName}さんがコメントしました`}
                        </p>
                      </div>

                      <p className="text-sm text-gray-600 mb-2">
                        「{notification.postContent}」
                        {notification.commentContent && (
                          <span className="block mt-1 text-blue-600">
                            💬 {notification.commentContent.slice(0, 50)}
                            {notification.commentContent.length > 50
                              ? "..."
                              : ""}
                          </span>
                        )}
                      </p>

                      <p className="text-xs text-gray-400">
                        {formatNotificationTime(notification)}
                      </p>
                    </div>

                    <ChevronRight
                      size={20}
                      className="text-gray-400 flex-shrink-0"
                    />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 新規投稿画面
  if (currentView === "newPost") {
    const handleSubmit = () => {
      let category = `${selectedCategory.emoji} ${selectedCategory.name}`;

      if (postType === "報告" && selectedDeclarationId) {
        const declaration = posts.find((p) => p.id === selectedDeclarationId);
        if (declaration) {
          category = declaration.category;
        }
      }

      const dateLabel = scheduledDate === "today" ? "今日" : "明日";
      createPost({
        type: postType,
        content: content || (postType === "宣言" ? "負荷宣言" : "負荷報告"),
        category: category,
        scheduledTime:
          postType === "宣言"
            ? `${dateLabel} ${selectedHour}:${selectedMinute}`
            : null,
        image: selectedImage,
        declarationId: postType === "報告" ? selectedDeclarationId : null,
      });
    };

    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <button
              onClick={() => setCurrentView("timeline")}
              className="text-gray-600 hover:text-gray-900"
            >
              <X size={24} />
            </button>
            <h2 className="text-lg font-semibold">新規投稿</h2>
            <button
              onClick={handleSubmit}
              className="bg-[#0062ff] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0050dd] transition"
            >
              投稿
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-2 sm:p-4">
          <div className="bg-white rounded-2xl p-6 mb-4">
            <p className="font-semibold mb-4">投稿タイプ</p>
            <div className="flex gap-3">
              <button
                onClick={() => setPostType("宣言")}
                className={`flex-1 py-3 rounded-xl font-medium transition ${
                  postType === "宣言"
                    ? "bg-[#0062ff] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                負荷宣言
              </button>
              <button
                onClick={() => setPostType("報告")}
                className={`flex-1 py-3 rounded-xl font-medium transition ${
                  postType === "報告"
                    ? "bg-[#00d084] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                負荷報告
              </button>
            </div>
          </div>

          {postType === "報告" && (
            <div className="bg-white rounded-2xl p-6 mb-4">
              <p className="font-semibold mb-4">宣言した負荷の達成を報告する</p>
              {(() => {
                const now = new Date();
                const oneDayAgo = new Date();
                oneDayAgo.setDate(oneDayAgo.getDate() - 1);

                const recentDeclarations = posts.filter((post) => {
                  if (post.type !== "宣言" || post.userId !== currentUser.id)
                    return false;

                  const postDate = post.createdAt?.seconds
                    ? new Date(post.createdAt.seconds * 1000)
                    : new Date(post.createdAt);
                  return postDate > oneDayAgo;
                });

                if (recentDeclarations.length === 0) {
                  return (
                    <div>
                      <p className="text-gray-500 text-sm mb-3">
                        24時間以内に行われた負荷宣言はありません
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    {recentDeclarations.map((dec) => (
                      <button
                        key={dec.id}
                        onClick={() => setSelectedDeclarationId(dec.id)}
                        className={`w-full p-3 rounded-lg text-left transition ${
                          selectedDeclarationId === dec.id
                            ? "bg-green-50 border-2 border-green-300"
                            : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                        }`}
                      >
                        <div className="text-sm text-gray-600">
                          {dec.scheduledTime}
                        </div>
                        <div className="font-medium">{dec.content}</div>
                      </button>
                    ))}
                  </div>
                );
              })()}

              <div className="mt-4 pt-4 border-t">
                <button
                  onClick={() => {
                    setSelectedDeclarationId(null);
                    if (!selectedCategory && categories.length > 0) {
                      setSelectedCategory(categories[0]);
                    }
                  }}
                  className={`w-full p-3 rounded-lg text-left transition ${
                    selectedDeclarationId === null
                      ? "bg-gray-100 border-2 border-gray-300"
                      : "bg-gray-50 border-2 border-transparent hover:bg-gray-100"
                  }`}
                >
                  <span className="text-gray-600">
                    宣言したこと以外の負荷報告をする
                  </span>
                </button>
              </div>
            </div>
          )}

          {(postType === "宣言" ||
            (postType === "報告" && selectedDeclarationId === null)) && (
            <div className="bg-white rounded-2xl p-6 mb-4">
              <p className="font-semibold mb-4">カテゴリ</p>
              <div className="grid grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat)}
                    className={`p-3 rounded-xl text-sm transition flex items-center gap-3 ${
                      selectedCategory?.id === cat.id
                        ? "bg-blue-50 text-[#0062ff] border-2 border-[#0062ff]"
                        : "bg-gray-50 text-gray-700 border-2 border-transparent hover:bg-gray-100"
                    }`}
                  >
                    <div className="text-2xl">{cat.emoji}</div>
                    <div className="font-medium text-left">{cat.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-6 mb-4">
            <p className="font-semibold mb-4">詳細やつぶやき</p>
            <textarea
              className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:border-[#0062ff] transition"
              rows="2"
              placeholder={
                postType === "宣言"
                  ? "朝7時から英語やります！ / 明日こそジム行きます"
                  : "朝ジム完了！ベンチプレス80kg達成！"
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {postType === "報告" && (
            <div className="bg-white rounded-2xl p-6 mb-4">
              <p className="font-semibold mb-4">写真</p>
              {!selectedImage ? (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-xl cursor-pointer hover:bg-gray-50 transition">
                  <Camera size={40} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">写真を選択</span>
                  <span className="text-xs text-gray-400 mt-1">
                    達成の証拠をアップロード
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*"
                    onChange={handleImageSelect}
                  />
                </label>
              ) : (
                <div className="relative">
                  <img
                    src={selectedImage}
                    alt="選択した画像"
                    className="w-full h-auto rounded-xl"
                  />
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition"
                  >
                    <X size={20} />
                  </button>
                </div>
              )}
            </div>
          )}

          {postType === "宣言" && (
            <div className="bg-white rounded-2xl p-6">
              <p className="font-semibold mb-4">実施日時</p>
              <button
                onClick={() => setShowTimePicker(true)}
                className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-[#0062ff] transition flex items-center justify-between group"
              >
                <div>
                  <span className="text-gray-800 font-medium text-lg">
                    {scheduledDate === "today" ? "今日" : "明日"} {selectedHour}
                    :{selectedMinute}
                  </span>
                  <p className="text-sm text-gray-500 mt-1">
                    タップして日時を選択
                  </p>
                </div>
                <ChevronRight className="text-gray-400 group-hover:text-[#0062ff] transition" />
              </button>
            </div>
          )}
        </div>

        {showTimePicker && <TimePicker />}
      </div>
    );
  }

  // マイページ画面
  if (currentView === "mypage") {
    const myReports = posts.filter(
      (post) => post.userId === currentUser.id && post.type === "報告"
    );
    const totalReports = myReports.length;

    const calculateStreak = () => {
      const reportDates = myReports
        .map((post) => {
          const date = post.createdAt?.seconds
            ? new Date(post.createdAt.seconds * 1000)
            : new Date(post.createdAt);
          return date.toDateString();
        })
        .filter((date, index, self) => self.indexOf(date) === index)
        .map((dateStr) => new Date(dateStr))
        .sort((a, b) => b - a);

      if (reportDates.length === 0) return 0;

      let streak = 1;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const latestPost = reportDates[0];
      const daysDiff = Math.floor((today - latestPost) / (1000 * 60 * 60 * 24));

      if (daysDiff > 1) return 0;

      for (let i = 0; i < reportDates.length - 1; i++) {
        const current = reportDates[i];
        const next = reportDates[i + 1];
        const diff = Math.floor((current - next) / (1000 * 60 * 60 * 24));

        if (diff === 1) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    };

    const currentStreak = calculateStreak();

    return (
      <div className="min-h-screen bg-gray-50 pb-20">
        <div className="bg-white shadow-sm sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCurrentView("timeline")}
                className="p-2 -ml-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ChevronRight size={24} className="rotate-180" />
              </button>
              <h1 className="text-xl font-bold">ホームへ戻る</h1>
            </div>
            <button
              onClick={() => {
                setCurrentUser(null);
                setCurrentView("login");
              }}
              className="text-red-500 text-sm font-medium"
            >
              ログアウト
            </button>
          </div>
        </div>

        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-white rounded-2xl p-6 mb-4 shadow-sm">
            <div className="flex items-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0062ff] to-[#00d084] rounded-full flex items-center justify-center text-white font-bold text-2xl">
                {currentUser && currentUser.name
                  ? currentUser.name.charAt(0).toUpperCase()
                  : "U"}
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold">
                  {currentUser && currentUser.name
                    ? currentUser.name
                    : "ユーザー"}
                </h2>
                <p className="text-gray-600">負荷を楽しむ人</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-[#0062ff]">
                  {totalReports}
                </p>
                <p className="text-sm text-gray-700 mt-1">累積負荷記録</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-[#00d084]">
                  {currentStreak}
                  <span className="text-lg">日</span>
                </p>
                <p className="text-sm text-gray-700 mt-1">連続負荷記録</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-4">最近の負荷報告</h3>
            {myReports.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                まだ負荷報告がありません
              </p>
            ) : (
              <div className="space-y-3">
                {myReports.slice(0, 5).map((post) => (
                  <div key={post.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{post.category}</p>
                        <p className="text-sm text-gray-600">{post.content}</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        {(() => {
                          const date = post.createdAt?.seconds
                            ? new Date(post.createdAt.seconds * 1000)
                            : new Date(post.createdAt);
                          return date.toLocaleDateString("ja-JP");
                        })()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // メインのタイムライン画面（デフォルト）
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-black">
              ナイス負荷<span className="text-[#00d084]">β</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView("notifications")}
              className="relative flex items-center gap-1 text-[#0062ff] font-medium hover:bg-blue-50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition text-sm sm:text-base"
            >
              <div className="relative">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="sm:w-5 sm:h-5"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadNotificationCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {unreadNotificationCount > 9
                      ? "9+"
                      : unreadNotificationCount}
                  </div>
                )}
              </div>
              <span className="hidden sm:inline">通知</span>
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-1 text-[#0062ff] font-medium hover:bg-blue-50 px-2 sm:px-3 py-1 sm:py-2 rounded-lg transition text-sm sm:text-base"
            >
              <UserPlus size={16} className="sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">友達追加</span>
            </button>
            <button
              onClick={handleLogout}
              className="text-[#0062ff] font-medium hover:bg-blue-50 px-2 sm:px-4 py-1 sm:py-2 rounded-lg transition text-sm sm:text-base"
            >
              ログアウト
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-2 sm:p-4">
        {posts.length === 0 ? (
          <div className="text-center py-12">
            <div className="mb-6">
              <UserPlus size={48} className="mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-2">まだ投稿がありません</p>
              <p className="text-sm text-gray-400 mb-4">
                友達を招待して一緒に負荷を共有しましょう！
              </p>
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-[#0062ff] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0050dd] transition text-sm"
              >
                友達を招待
              </button>
            </div>
            <div className="border-t pt-6">
              <p className="text-sm text-gray-400 mb-4">
                または下の「+」ボタンから最初の投稿をしてみましょう！
              </p>
            </div>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              id={`post-${post.id}`}
              className={`rounded-2xl shadow-sm hover:shadow-md transition-all mb-3 sm:mb-4 overflow-hidden ${
                post.type === "宣言"
                  ? "bg-blue-50 border-2 border-blue-200"
                  : "bg-green-50 border-2 border-green-200"
              } ${
                highlightedPostId === post.id
                  ? "ring-4 ring-yellow-400 ring-opacity-75 shadow-xl transform scale-[1.02]"
                  : ""
              }`}
            >
              <div className="bg-white m-0.5 rounded-2xl">
                <div className="p-3 sm:p-6">
                  <div className="flex items-start mb-3 sm:mb-4 gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#0062ff] to-[#00d084] rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-lg flex-shrink-0">
                      {post.userName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">
                        {post.userName}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                        <p className="text-sm sm:text-lg font-medium text-gray-700 break-words">
                          {post.category}
                        </p>
                        {post.type === "宣言" && post.scheduledTime && (
                          <span className="text-xs sm:text-base text-[#0062ff] font-medium break-words">
                            {post.scheduledTime}
                          </span>
                        )}
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 sm:px-3 sm:py-1 rounded-full flex-shrink-0 ${
                        post.type === "宣言"
                          ? "bg-blue-100 text-[#0062ff]"
                          : "bg-green-100 text-[#00d084]"
                      }`}
                    >
                      <span className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                        {post.type === "宣言" ? "🎯 負荷宣言" : "✅ 負荷報告"}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-800 mb-3 sm:mb-4 text-sm sm:text-lg leading-relaxed break-words">
                    {post.content}
                  </p>

                  {post.type === "報告" &&
                    post.declarationId &&
                    (() => {
                      const declaration = posts.find(
                        (p) => p.id === post.declarationId
                      );
                      if (declaration) {
                        return (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 mb-3 sm:mb-4">
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-green-700 mb-1">
                              <CheckCircle
                                size={14}
                                className="sm:w-4 sm:h-4 flex-shrink-0"
                              />
                              <span className="font-medium">
                                宣言を達成しました！
                              </span>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 break-words">
                              <span className="font-medium">元の宣言：</span>
                              {declaration.content}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}

                  {post.image && (
                    <div className="mb-3 sm:mb-4 rounded-xl overflow-hidden">
                      <img
                        src={post.image}
                        alt="投稿画像"
                        className="w-full h-auto"
                      />
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
                    <div className="flex items-center gap-2 sm:gap-4">
                      <button
                        onClick={() => addReaction(post.id)}
                        className={`flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all ${
                          post.type === "宣言"
                            ? "text-[#0062ff] hover:bg-blue-50"
                            : "text-[#00d084] hover:bg-green-50"
                        }`}
                      >
                        <Heart
                          size={16}
                          className={`sm:w-5 sm:h-5 flex-shrink-0 ${
                            (post.reactionsCount || post.reactions || 0) > 0
                              ? "fill-current"
                              : ""
                          }`}
                          fill={
                            (post.reactionsCount || post.reactions || 0) > 0
                              ? "currentColor"
                              : "none"
                          }
                          strokeWidth={2}
                        />
                        <span className="text-sm sm:text-base whitespace-nowrap">
                          {post.type === "宣言" ? "レッツ負荷" : "ナイス負荷"}{" "}
                          {post.reactionsCount || post.reactions || 0}
                        </span>
                      </button>

                      <button
                        onClick={() => toggleComments(post.id)}
                        className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium transition-all text-gray-600 hover:bg-gray-50"
                      >
                        <MessageCircle
                          size={16}
                          className="sm:w-5 sm:h-5 flex-shrink-0"
                          strokeWidth={2}
                        />
                        <span className="text-sm sm:text-base whitespace-nowrap">
                          コメント{" "}
                          {post.comments
                            ? Object.keys(post.comments).length
                            : 0}
                        </span>
                      </button>
                    </div>

                    {/* リアクションした人の表示 */}
                    {post.reactionsList && post.reactionsList.length > 0 && (
                      <div className="mt-2 text-xs sm:text-sm text-gray-500">
                        <span className="font-medium">
                          {post.type === "宣言"
                            ? "🎯 レッツ負荷"
                            : "💚 ナイス負荷"}
                          :
                        </span>
                        <span className="ml-1">
                          {post.reactionsList
                            .slice(-3)
                            .map((reaction, index, arr) => (
                              <span key={reaction.userId}>
                                {reaction.userName}
                                {index < arr.length - 1 && "、"}
                              </span>
                            ))}
                          {post.reactionsList.length > 3 && (
                            <span> 他{post.reactionsList.length - 3}人</span>
                          )}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-gray-500 self-end sm:self-auto">
                      <Target
                        size={12}
                        className="sm:w-4 sm:h-4 flex-shrink-0"
                      />
                      <span className="font-medium break-words">
                        投稿{" "}
                        {(() => {
                          const date = post.createdAt?.seconds
                            ? new Date(post.createdAt.seconds * 1000)
                            : new Date(post.createdAt);
                          return date.toLocaleDateString("ja-JP");
                        })()}{" "}
                        {(() => {
                          const date = post.createdAt?.seconds
                            ? new Date(post.createdAt.seconds * 1000)
                            : new Date(post.createdAt);
                          return date.toLocaleTimeString("ja-JP", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });
                        })()}
                      </span>
                    </div>
                  </div>

                  {showComments[post.id] && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      {post.comments &&
                        Object.entries(post.comments).length > 0 && (
                          <div className="space-y-3 mb-4">
                            {Object.entries(post.comments)
                              .sort(([, a], [, b]) => {
                                const dateA = a.createdAt?.seconds
                                  ? new Date(a.createdAt.seconds * 1000)
                                  : new Date(a.createdAt);
                                const dateB = b.createdAt?.seconds
                                  ? new Date(b.createdAt.seconds * 1000)
                                  : new Date(b.createdAt);
                                return dateA - dateB;
                              })
                              .map(([commentId, comment]) => (
                                <div
                                  key={commentId}
                                  className="flex gap-2 sm:gap-3"
                                >
                                  <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">
                                    {comment.userName?.charAt(0) || "?"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="bg-gray-50 rounded-2xl px-3 py-2 sm:px-4 sm:py-3">
                                      <p className="font-semibold text-xs sm:text-sm text-gray-900">
                                        {comment.userName}
                                      </p>
                                      <p className="text-sm sm:text-base text-gray-800 break-words leading-relaxed">
                                        {comment.content}
                                      </p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1 ml-2">
                                      {(() => {
                                        const date = comment.createdAt?.seconds
                                          ? new Date(
                                              comment.createdAt.seconds * 1000
                                            )
                                          : new Date(comment.createdAt);
                                        return date.toLocaleTimeString(
                                          "ja-JP",
                                          {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          }
                                        );
                                      })()}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        )}

                      <div className="flex gap-2 sm:gap-3 items-end">
                        <div className="w-6 h-6 sm:w-8 sm:h-8 bg-gradient-to-br from-[#0062ff] to-[#00d084] rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold flex-shrink-0">
                          {currentUser.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="コメントを入力..."
                              className="flex-1 px-3 py-2 sm:px-4 sm:py-2 border border-gray-200 rounded-2xl focus:outline-none focus:border-[#0062ff] transition text-sm sm:text-base"
                              value={commentText[post.id] || ""}
                              onChange={(e) =>
                                setCommentText((prev) => ({
                                  ...prev,
                                  [post.id]: e.target.value,
                                }))
                              }
                              onKeyPress={(e) => {
                                if (e.key === "Enter") {
                                  addComment(post.id);
                                }
                              }}
                            />
                            <button
                              onClick={() => addComment(post.id)}
                              disabled={!commentText[post.id]?.trim()}
                              className="px-3 py-2 sm:px-4 sm:py-2 bg-[#0062ff] text-white rounded-2xl hover:bg-[#0050dd] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                            >
                              <Send size={14} className="sm:w-4 sm:h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold">友達を追加</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  あなたの招待コード
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-center">
                    <span className="text-lg font-bold text-[#0062ff] tracking-wider">
                      {inviteCode}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteCode);
                      alert("コードをコピーしました！");
                    }}
                    className="px-3 py-2 bg-[#0062ff] text-white rounded-lg hover:bg-[#0050dd] transition"
                  >
                    <Copy size={16} />
                  </button>
                  <button
                    onClick={() => {
                      const inviteLink = generateInviteLink();
                      const inviteMessage = `最近どう？負荷かかってる？

${currentUser.name}さんからナイス負荷(β版)の招待が来ています！
${inviteLink}

#ナイス負荷`;

                      navigator.clipboard.writeText(inviteMessage);
                      alert("招待メッセージをコピーしました！");
                    }}
                    className="px-3 py-2 bg-[#00d084] text-white rounded-lg hover:bg-[#00b574] transition flex items-center gap-1"
                  >
                    🔗 <span className="text-xs">メッセージ</span>
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">
                  友達の招待コードを入力
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="6桁の数字を入力"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#0062ff] transition text-center text-lg tracking-wider"
                    value={inputInviteCode}
                    onChange={(e) =>
                      setInputInviteCode(
                        e.target.value.replace(/[^0-9]/g, "").slice(0, 6)
                      )
                    }
                    maxLength={6}
                  />
                  <button
                    onClick={() => addFriend(inputInviteCode)}
                    disabled={inputInviteCode.length !== 6}
                    className="w-full bg-[#00d084] text-white py-3 rounded-xl font-semibold hover:bg-[#00b574] transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    友達を追加
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t">
                <p className="text-sm text-gray-600 text-center">
                  現在の友達: {friends.length}人
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-area-pb">
        <div className="max-w-2xl mx-auto px-2 sm:px-4 py-1 sm:py-2 flex justify-around">
          <button className="flex flex-col items-center p-2 text-[#0062ff]">
            <Home size={20} className="sm:w-6 sm:h-6" />
            <span className="text-xs mt-1 font-medium">ホーム</span>
          </button>
          <button
            className="relative -top-1 sm:-top-2"
            onClick={() => setCurrentView("newPost")}
          >
            <div className="bg-[#0062ff] text-white rounded-full p-3 sm:p-4 shadow-lg hover:shadow-xl transition hover:bg-[#0050dd]">
              <PlusCircle size={24} className="sm:w-7 sm:h-7" />
            </div>
          </button>
          <button
            onClick={() => setCurrentView("mypage")}
            className={`flex flex-col items-center p-2 transition ${
              currentView === "mypage"
                ? "text-[#0062ff]"
                : "text-gray-400 hover:text-[#0062ff]"
            }`}
          >
            <User size={20} className="sm:w-6 sm:h-6" />
            <span className="text-xs mt-1 font-medium">マイページ</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FukaApp;
