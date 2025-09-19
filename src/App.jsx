import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, ChevronsRight, Download, RotateCcw, Settings, X, AlertCircle, Loader, HardDriveDownload, Copy, Check, HelpCircle, Bug, ShieldCheck, Megaphone } from 'lucide-react';

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";

// === CDN & ライブラリの定義 ===

// 外部ライブラリのCDN URL
const HEIC_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const FILESAVER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};


// Firebaseアプリを初期化
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 定数とヘルパー関数 ===

// 設計書で定義されたリサイズ後の固定サイズ
const RESIZE_WIDTH = 600;
const RESIZE_HEIGHT = 400;

// スプレッドシート連携に失敗した場合のフォールバック用初期データ
const INITIAL_INDUSTRY_CODES = [
  { code: 'hos', name: '病院' },
  { code: 'htl', name: 'ホテル' },
  { code: 'sal', name: 'サロン' },
  { code: 'tra', name: 'しつけ教室' },
  { code: 'caf', name: 'カフェ' },
  { code: 'run', name: 'ドッグラン' },
];

/**
 * カスタムフック：外部スクリプトを動的に読み込む
 * @param {string} url スクリプトのURL
 * @returns {{isLoaded: boolean, error: Error | null}} 読み込み状態とエラー
 */
const useScript = (url) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let script = document.querySelector(`script[src="${url}"]`);
    if (script && script.getAttribute('data-loaded')) {
      setIsLoaded(true);
      return;
    }

    if (!script) {
      script = document.createElement('script');
      script.src = url;
      script.async = true;
      document.body.appendChild(script);
    }

    const onLoad = () => {
      script.setAttribute('data-loaded', 'true');
      setIsLoaded(true);
    };
    const onError = (e) => setError(e);

    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);

    return () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [url]);

  return { isLoaded, error };
};

/**
 * 軽量なサムネイルを生成する
 * @param {string} imageUrl 画像のURL
 * @returns {Promise<string>} サムネイルのData URL
 */
const createThumbnail = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_DIMENSION = 200; // サムネイルの最大サイズ
      let { width, height } = img;

      if (width > height) {
        if (width > MAX_DIMENSION) {
          height *= MAX_DIMENSION / width;
          width = MAX_DIMENSION;
        }
      } else {
        if (height > MAX_DIMENSION) {
          width *= MAX_DIMENSION / height;
          height = MAX_DIMENSION;
        }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
};

/**
 * YYYYMMDD形式の日付文字列を取得する
 * @returns {string} フォーマットされた日付文字列
 */
const getFormattedDate = () => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

// === Reactコンポーネント ===

/**
 * アプリケーションヘッダーコンポーネント
 */
const AppHeader = ({ currentStep, steps, isLoading }) => {
  return (
    <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/80 px-4 sm:px-6 py-3 grid grid-cols-3 items-center flex-shrink-0 h-20 z-10">
      <div className="text-base sm:text-lg font-bold text-gray-800 truncate">
        業種別リネーム＆加工ツール（β版）
      </div>

      <div className="flex justify-center">
        <div className="flex items-center">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;

            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center w-16 sm:w-24">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
                      ${isCompleted ? 'bg-blue-500 border-blue-500 text-white' : ''}
                      ${isCurrent ? 'bg-white border-blue-500 text-blue-600 ring-4 ring-blue-500/20' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}
                    `}
                  >
                    {isCurrent && isLoading ? (
                      <Loader size={18} className="animate-spin" />
                    ) : isCompleted ? (
                      <Check size={18} />
                    ) : (
                      stepNumber
                    )}
                  </div>
                  <span className={`mt-2 text-xs font-semibold transition-colors duration-300 ${isCurrent ? 'text-blue-600' : 'text-gray-500'} hidden sm:block`}>
                    {step.name}
                  </span>
                </div>

                {index < steps.length - 1 && (
                  <div className={`w-4 sm:w-12 h-1 -mx-1 sm:-mx-2 ${!isCurrent && !isCompleted ? 'mb-0 sm:mb-6' : 'mb-6'} transition-colors duration-300 rounded-full
                    ${currentStep > stepNumber ? 'bg-blue-400' : 'bg-gray-300'}
                  `} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      <div className="flex justify-end items-center space-x-2">
        <a
          href="privacy.html"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:bg-gray-200/80 hover:text-gray-700 transition-colors"
          aria-label="プライバシーポリシーを開く"
        >
          <ShieldCheck size={24} />
        </a>
      </div>
    </header>
  );
};


/**
 * 更新通知バナー
 */
const UpdateBanner = ({ latestUpdate, onOpen }) => {
  if (!latestUpdate) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-between shadow-sm mb-4">
      <div className="flex items-center space-x-2">
        <Megaphone className="text-blue-500" size={20} />
        <span className="font-semibold">最新バージョンがリリースされました</span>
      </div>
      <button
        onClick={onOpen}
        className="ml-4 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition"
      >
        詳しくはこちら
      </button>
    </div>
  );
};

/**
 * === ▼▼▼ 通知モーダルを汎用化（ここから）▼▼▼ ===
 * 通知モーダルコンポーネント（welcome, agreement, update対応）
 */
const NotificationModal = ({ notifications, onClose }) => {
  if (!notifications || notifications.length === 0) return null;

  // アイコンのマッピング
  const categoryIcons = {
    feature: '✨',
    improvement: '✅',
    fix: '🔧',
  };

  const first = notifications[0];
  const type = first.type;

  // コンテンツ部分を動的に生成
  const Content = () => {
    switch (type) {
      case 'welcome':
      case 'agreement':
        return (
          <div>
            <p className="text-sm text-gray-500 mb-4">{first.content.date}</p>
            <p className="text-gray-700 whitespace-pre-wrap">{first.content.body}</p>
            {first.content.link && (
              <a
                href={first.content.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline mt-4 inline-block"
              >
                {first.content.linkText || '詳しくはこちら'}
              </a>
            )}
          </div>
        );
      case 'update':
        return (
          <div className="space-y-6">
            {[...notifications]
              .sort((a, b) => new Date(b.content.date) - new Date(a.content.date))
              .map((n) => (
                <div key={n.id} className="border-b border-gray-200 pb-4 last:border-none">
                  <p className="text-sm text-gray-500 mb-2">
                    バージョン {n.content.version} ({n.content.date})
                  </p>
                  {n.content.features?.length > 0 && (
                    <div className="mb-2">
                      <h3 className="font-semibold text-gray-800">新機能・改善</h3>
                      <ul className="list-none text-sm text-gray-700 space-y-1 pl-2">
                        {n.content.features.map((item, i) => (
                          <li key={`feat-${n.id}-${i}`} className="flex items-start">
                            <span className="mr-2">{categoryIcons[item.category] || '➡️'}</span>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {n.content.fixes?.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-800">修正点</h3>
                      <ul className="list-none text-sm text-gray-700 space-y-1 pl-2">
                        {n.content.fixes.map((item, i) => (
                          <li key={`fix-${n.id}-${i}`} className="flex items-start">
                            <span className="mr-2">{categoryIcons[item.category] || '➡️'}</span>
                            <span>{item.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
          </div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch(type) {
      case 'welcome':
        return first.content.title || 'ようこそ！';
      case 'agreement':
        return first.content.title || '重要なお知らせ';
      case 'update':
        return '更新履歴（未確認分）';
      default:
        return 'お知らせ';
    }
  };

  const getButtonText = () => {
    switch(type) {
        case 'welcome':
            return '利用を開始する';
        case 'agreement':
            return '同意して次へ';
        default:
            return '確認しました';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300 ease-in-out">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col animate-fade-in-scale">
        <header className="flex items-center justify-between p-5 border-b border-gray-200 bg-gray-50/70 rounded-t-2xl">
          <h2 className="text-xl font-bold text-gray-800 flex items-center">
            <Megaphone className="mr-3 text-blue-500" />
            {getTitle()}
          </h2>
        </header>
        <div className="p-6 flex-grow overflow-y-auto">
          <Content />
        </div>
        <footer className="flex justify-end p-4 border-t border-gray-200 bg-gray-50/70 rounded-b-2xl">
          <button
            onClick={() => onClose(true)}
            className="px-8 py-2.5 rounded-lg text-white font-semibold bg-blue-600 hover:bg-blue-700 transition-all duration-200 transform hover:scale-105"
          >
            {getButtonText()}
          </button>
        </footer>
      </div>
       <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-scale {
          animation: fade-in-scale 0.3s forwards cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
};
/**
 * === ▲▲▲ 通知モーダルを汎用化（ここまで）▲▲▲ ===
 */


/**
 * アラート表示コンポーネント
 */
const Alert = ({ message, type = 'error', onDismiss }) => {
  if (!message) return null;
  const colors = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
  };

  return (
    <div className={`border-l-4 p-4 rounded-md shadow-md ${colors[type]}`} role="alert">
      <div className="flex items-center">
        <AlertCircle className="mr-3" />
        <p className="font-bold">{message}</p>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-auto text-xl font-bold">&times;</button>
        )}
      </div>
    </div>
  );
};

/**
 * ローディング画面コンポーネント
 */
const LoadingScreen = ({ title, progress, total }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-gray-100">
    <div className="relative">
      <div className="w-28 h-28 bg-white/70 backdrop-blur-lg rounded-full flex items-center justify-center shadow-lg">
        <Loader className="w-16 h-16 text-blue-500 animate-spin" />
      </div>
    </div>
    <h2 className="text-2xl font-semibold mt-10 text-gray-700 tracking-wide">
      {title}
    </h2>
    {progress !== undefined && total !== undefined && total > 0 && (
      <div className="w-full max-w-sm mt-8">
        <p className="mb-2 text-lg font-medium text-gray-600">
          {`${progress} / ${total} 件`}
        </p>
        <div className="w-full bg-gray-200/80 rounded-full h-3 shadow-inner overflow-hidden">
          <div 
            className="bg-gradient-to-r from-blue-500 to-sky-500 h-3 rounded-full transition-all duration-500 ease-out" 
            style={{ width: `${(progress / total) * 100}%` }}
          ></div>
        </div>
      </div>
    )}
  </div>
);

/**
 * STEP 1: 画像アップロード画面
 */
const UploadScreen = ({ onFilesAccepted, setErrors }) => {
  const onDrop = useCallback((acceptedFiles, fileRejections, event) => {
    let currentErrors = [];
    if (acceptedFiles.length + fileRejections.length > 50) {
      currentErrors.push('一度にアップロードできるファイルは50枚までです。');
    }

    fileRejections.forEach(rejection => {
      rejection.errors.forEach(err => {
        if (err.code === 'file-too-large') {
          currentErrors.push(`ファイルサイズが大きすぎます: ${rejection.file.name} (10MBまで)`);
        }
        if (err.code === 'file-invalid-type') {
          currentErrors.push(`対応していないファイル形式です: ${rejection.file.name}`);
        }
      });
    });

    if (currentErrors.length > 0) {
      setErrors(currentErrors);
      return;
    }

    if (acceptedFiles.length > 0) {
      const method = event.type === 'drop' ? 'drag_and_drop' : 'button_click';
      onFilesAccepted(acceptedFiles, method);
    }
  }, [onFilesAccepted, setErrors]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic', '.heif'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    noClick: true,
    noKeyboard: true,
  });

  return (
    <div {...getRootProps()} className="w-full h-full overflow-y-auto bg-gray-100 relative">
      <input {...getInputProps()} />
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-8 py-10 sm:py-12 text-center flex flex-col items-center justify-center min-h-full">
        <div>
          <h1 className="text-3xl sm:text-5xl font-bold text-gray-800 tracking-tight">
            画像ファイルをアップロード
          </h1>
          <p className="text-base sm:text-lg text-gray-500 mt-4 mb-8 sm:mb-12">
            加工したいファイルをドラッグ＆ドロップするか、ボタンから選択してください。
          </p>
          <div 
            className="relative w-full h-80 sm:h-96 rounded-3xl flex flex-col items-center justify-center 
                       bg-white/60 backdrop-blur-xl border border-gray-200/50 shadow-xl p-4"
          >
            <div className="text-center">
              <UploadCloud className="w-16 sm:w-20 h-16 sm:h-20 text-gray-400 mx-auto" />
              <p className="mt-6 text-lg sm:text-xl font-medium text-gray-700">
                この画面にファイル・フォルダをドラッグ＆ドロップ
              </p>
              
              <p className="mt-2 text-sm text-gray-500">または</p>
              <button 
                type="button" 
                onClick={(e) => {
                    e.stopPropagation();
                    open();
                }} 
                className="mt-6 px-6 sm:px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg 
                           hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-200"
              >
                ファイルを選択
              </button>
            </div>
            <div className="absolute bottom-4 sm:bottom-6 text-center w-full text-xs text-gray-500 px-2">
              <p>対応: JPG, PNG, HEIC  |  サイズ: 10MBまで  |  上限: 50枚</p>
            </div>
          </div>
        </div>
      </div>
      {isDragActive && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center 
                       bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out p-4">
          <UploadCloud className="w-24 sm:w-32 h-24 sm:h-32 text-white/90 animate-bounce" />
          <p className="mt-8 text-2xl sm:text-4xl font-bold text-white text-center">
            ファイルをドロップしてアップロード
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * 業種管理モーダル
 */
const IndustryManagementModal = ({ isOpen, onClose, spreadsheetUrl, spreadsheetMode, onConnect, connectionStatus }) => {
    const [localUrl, setLocalUrl] = useState(spreadsheetUrl || '');
    const [localMode, setLocalMode] = useState(spreadsheetMode || 'replace');

    useEffect(() => {
        setLocalUrl(spreadsheetUrl || '');
        setLocalMode(spreadsheetMode || 'replace');
    }, [spreadsheetUrl, spreadsheetMode, isOpen]);

    if (!isOpen) return null;

    const handleConnect = () => {
        onConnect(localUrl, localMode);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-lg">
                <header className="flex items-center justify-between p-5 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center">
                        <Settings className="mr-3 text-gray-500" />
                        業種マスタ連携設定
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800 rounded-full p-1 hover:bg-gray-200/60 transition-colors">
                        <X size={24} />
                    </button>
                </header>
                <main className="p-6 flex-grow overflow-y-auto space-y-6 text-gray-700">
                    <div>
                        <h3 className="text-lg font-semibold mb-3">【連携マニュアル】</h3>
                        <ol className="list-decimal list-inside space-y-4 bg-white/50 p-5 rounded-xl border border-gray-200 text-sm">
                            <li>
                                A列に業種コード、B列に業種名を入力したスプレッドシートを作成します。
                                <table className="w-full mt-2 border-collapse border border-gray-300 text-left text-xs">
                                    <thead>
                                        <tr>
                                            <th className="border border-gray-300 bg-gray-100 p-1.5 w-1/2">A</th>
                                            <th className="border border-gray-300 bg-gray-100 p-1.5 w-1/2">B</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td className="border border-gray-300 p-1.5">gyoushuA</td>
                                            <td className="border border-gray-300 p-1.5">業種A</td>
                                        </tr>
                                         <tr>
                                            <td className="border border-gray-300 p-1.5">...</td>
                                            <td className="border border-gray-300 p-1.5">...</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </li>
                            <li>
                                右上の「共有」ボタンから、アクセス権を「<strong className="text-blue-600 font-semibold">リンクを知っている全員</strong>」に変更し、「<strong className="text-blue-600 font-semibold">閲覧者</strong>」として設定してください。
                            </li>
                            <li>共有設定したスプレッドシートのURLを下の欄に貼り付けてください。</li>
                        </ol>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-3">【連携方法】</h3>
                        <div className="space-y-3 bg-white/50 p-5 rounded-xl border border-gray-200">
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="spreadsheet-mode"
                                    value="replace"
                                    checked={localMode === 'replace'}
                                    onChange={(e) => setLocalMode(e.target.value)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-3 text-sm text-gray-700">
                                    スプレッドシートの業種リストで<strong className="font-semibold">上書きする (置き換え)</strong>
                                </span>
                            </label>
                            <label className="flex items-center cursor-pointer">
                                <input
                                    type="radio"
                                    name="spreadsheet-mode"
                                    value="add"
                                    checked={localMode === 'add'}
                                    onChange={(e) => setLocalMode(e.target.value)}
                                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                                />
                                <span className="ml-3 text-sm text-gray-700">
                                    既存の業種リストに、スプレッドシートの内容を<strong className="font-semibold">追加する</strong>
                                </span>
                            </label>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="spreadsheetUrlModal" className="text-base font-semibold mb-3 block">スプレッドシートURL:</label>
                        <div className="flex flex-col sm:flex-row gap-3">
                            <input
                                id="spreadsheetUrlModal"
                                type="text"
                                value={localUrl}
                                onChange={(e) => setLocalUrl(e.target.value)}
                                placeholder="URLが空の状態で連携すると設定が解除されます"
                                className="flex-grow px-4 py-3 bg-white/80 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                            <button onClick={handleConnect} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition whitespace-nowrap">連携</button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-3">【ステータス】</h3>
                        <div className="p-4 bg-white/50 rounded-xl min-h-[100px] border border-gray-200 flex items-center justify-center text-center">
                           {connectionStatus.status === 'testing' && (
                                <p className="text-gray-500 flex items-center"><Loader size={18} className="animate-spin mr-2"/>連携中...</p>
                           )}
                           {connectionStatus.status === 'success' && (
                               <p className="text-green-600 font-bold flex items-center">
                                   <Check className="mr-2"/>
                                   {connectionStatus.message}
                               </p>
                           )}
                           {connectionStatus.status === 'error' && (
                                <p className="text-red-600 font-bold flex items-center">
                                    <AlertCircle className="mr-2"/>{connectionStatus.message}
                                </p>
                           )}
                           {connectionStatus.status === 'idle' && (
                                <p className="text-gray-500">URLを入力し「連携」ボタンで設定を反映してください。</p>
                           )}
                        </div>
                    </div>
                </main>
                <footer className="flex justify-center p-4 border-t border-gray-200">
                    <button onClick={onClose} className="w-full sm:w-auto px-8 py-3 rounded-lg text-white font-bold bg-gray-600 hover:bg-gray-700 shadow-md transition">閉じる</button>
                </footer>
            </div>
        </div>
    );
};

/**
 * STEP 2: ファイル名設定画面
 */
const BulkSettingsScreen = ({ onNext, onBack, bulkSettings, setBulkSettings, industryCodes, onConnect, spreadsheetUrl, spreadsheetMode }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState({ status: 'idle', data: [], message: '' });

    // モーダルから連携実行が要求された際のハンドラ
    const handleConnect = async (url, mode) => {
        setConnectionStatus({ status: 'testing', data: [], message: '' });
        // 親から渡された連携処理を実行し、結果をstateにセットする
        const result = await onConnect(url, mode);
        setConnectionStatus(result);
    };

    // 「次へ」ボタンの無効化判定ロジックを更新
    const isNextDisabled = !bulkSettings.industryCode || !/^\d+$/.test(bulkSettings.submissionId) || !/^\d{8}$/.test(bulkSettings.date) || !/^\d+$/.test(bulkSettings.startSequence);

    return (
        <div className="w-full h-full overflow-y-auto bg-gray-100">
            <div className="w-full max-w-xl mx-auto px-4 sm:px-8 py-10 sm:py-12">
                <h2 className="text-3xl sm:text-4xl font-bold text-center text-gray-800 tracking-tight">ファイル名設定</h2>
                <p className="text-center text-lg text-gray-500 mt-3 mb-10">リネーム後のファイル名に使用する共通の情報を設定します。</p>
                <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 shadow-xl rounded-3xl p-6 sm:p-8 space-y-8">
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-3">業種</label>
                        <div className="flex items-center gap-3">
                            <select
                                value={bulkSettings.industryCode}
                                onChange={(e) => setBulkSettings(p => ({ ...p, industryCode: e.target.value }))}
                                className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            >
                                <option value="" disabled>業種を選択してください</option>
                                {industryCodes.map(ic => <option key={ic.code} value={ic.code}>{ic.name} ({ic.code})</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="submissionId" className="block text-base font-semibold text-gray-700 mb-3">入稿ID</label>
                        <input
                            id="submissionId"
                            type="text"
                            value={bulkSettings.submissionId}
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                setBulkSettings(p => ({ ...p, submissionId: numericValue }));
                            }}
                            placeholder="例: 12345"
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                        <p className="text-xs text-gray-500 mt-2">※半角数字のみ入力できます</p>
                    </div>
                    <div>
                        <label htmlFor="date" className="block text-base font-semibold text-gray-700 mb-3">日付</label>
                        <input
                            id="date"
                            type="text"
                            value={bulkSettings.date}
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                setBulkSettings(p => ({ ...p, date: numericValue }))
                            }}
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                         <p className="text-xs text-gray-500 mt-2">※YYYYMMDD形式（8桁）で入力してください</p>
                    </div>
                    <div>
                        <label htmlFor="startSequence" className="block text-base font-semibold text-gray-700 mb-3">連番開始番号</label>
                        <input
                            id="startSequence"
                            type="text"
                            value={bulkSettings.startSequence}
                            onChange={(e) => {
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                setBulkSettings(p => ({ ...p, startSequence: numericValue }));
                            }}
                            placeholder="例: 1"
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                        <p className="text-xs text-gray-500 mt-2">※デフォルトは1です。半角数字で入力してください。</p>
                    </div>
                </div>
                <div className="flex justify-between mt-10">
                    <button 
                        onClick={onBack} 
                        className="flex items-center px-6 py-3 rounded-xl text-gray-700 font-semibold bg-gray-200 hover:bg-gray-300 transition"
                    >
                        <RotateCcw size={18} className="mr-2" /> 戻る
                    </button>
                    <button 
                        onClick={onNext} 
                        disabled={isNextDisabled} 
                        className="flex items-center px-8 py-3 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg disabled:bg-gray-400 disabled:shadow-none disabled:transform-none disabled:cursor-not-allowed"
                    >
                        次へ <ChevronsRight size={20} className="ml-2" />
                    </button>
                </div>
            </div>
            <IndustryManagementModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setConnectionStatus({ status: 'idle', data: [], message: '' });
                }}
                spreadsheetUrl={spreadsheetUrl}
                spreadsheetMode={spreadsheetMode}
                onConnect={handleConnect}
                connectionStatus={connectionStatus}
            />
        </div>
    );
};

/**
 * STEP 3: 確認画面
 */
const ConfirmEditScreen = ({ images, setImages, onProcess, onBack, industryCodes, bulkSettings }) => {
    const [selectedImageId, setSelectedImageId] = useState(null);

    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        }
    }, [images, selectedImageId]);

    const selectedImage = images.find(img => img.id === selectedImageId);
    
    const generateNewFilename = (image) => {
        const startSequenceNumber = parseInt(bulkSettings.startSequence, 10) || 1;
        const sequence = String(images.findIndex(img => img.id === image.id) + startSequenceNumber).padStart(2, '0');
        const extension = 'jpg';
        return `${image.industryCode}_${image.submissionId}_${image.date}_${sequence}.${extension}`;
    };

    return (
        <div className="w-full flex-grow flex flex-col bg-gray-100 overflow-hidden min-h-0">
            <main className="flex-grow flex flex-col md:flex-row min-h-0 overflow-hidden">
                <div className="flex-1 border-b md:border-b-0 md:border-r border-gray-200/80 overflow-y-auto p-4 space-y-3 min-h-0">
                    <p className="text-sm text-gray-500 px-2 pb-2">ファイル一覧 ({images.length}件)</p>
                    {images.map(image => (
                        <div
                            key={image.id}
                            onClick={() => setSelectedImageId(image.id)}
                            className={`flex items-center p-3 space-x-4 border rounded-2xl cursor-pointer transition-all duration-200
                                ${selectedImageId === image.id 
                                    ? 'bg-white/80 shadow-lg border-blue-500' 
                                    : 'bg-white/40 border-transparent hover:shadow-md hover:bg-white/60'
                                }`}
                        >
                            <img src={image.thumbnailUrl} alt={image.file.name} className="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded-lg bg-gray-100/80 flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <p className="text-xs text-gray-500 truncate" title={image.file.name}>{image.file.name}</p>
                                <p className="font-bold text-sm text-blue-600 truncate" title={generateNewFilename(image)}>{generateNewFilename(image)}</p>
                                <p className="text-xs text-gray-500 mt-1">出力サイズ: {RESIZE_WIDTH} x {RESIZE_HEIGHT} px</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="w-full md:w-2/5 flex flex-col bg-white/30 flex-shrink-0">
                    <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                        <h3 className="text-xl font-semibold text-gray-800 pb-2">選択中画像の確認</h3>
                        {selectedImage ? (
                            <div className="space-y-6">
                                <div className="bg-gray-100 p-3 rounded-xl">
                                    <p className="text-xs font-semibold text-gray-600">元ファイル名</p>
                                    <p className="text-sm text-gray-800 truncate mt-1">{selectedImage.file.name}</p>
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">業種</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={industryCodes.find(ic => ic.code === selectedImage.industryCode)?.name + ` (${selectedImage.industryCode})` || selectedImage.industryCode}
                                        className="w-full px-4 py-3 bg-gray-200/60 border border-gray-300/50 rounded-xl outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">入稿ID</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={selectedImage.submissionId}
                                        className="w-full px-4 py-3 bg-gray-200/60 border border-gray-300/50 rounded-xl outline-none cursor-not-allowed"
                                    />
                                </div>
                                 <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">日付</label>
                                    <input
                                        type="text"
                                        disabled
                                        value={selectedImage.date}
                                        className="w-full px-4 py-3 bg-gray-200/60 border border-gray-300/50 rounded-xl outline-none cursor-not-allowed"
                                    />
                                </div>
                                <div className="pt-6 border-t border-gray-200/60 flex justify-between items-center">
                                    <button onClick={onBack} className="flex items-center px-6 py-3 rounded-xl text-gray-700 font-semibold bg-gray-200 hover:bg-gray-300 transition">
                                        <RotateCcw size={18} className="mr-2" /> 戻る
                                    </button>
                                    <button onClick={onProcess} className="flex items-center px-6 py-3 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg">
                                        加工に進む <ChevronsRight size={20} className="ml-2" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center mt-10">リストから画像を選択してください</p>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

/**
 * STEP 4: ダウンロード画面
 */
const DownloadScreen = ({ zipBlob, zipFilename, onRestart, onDownload }) => {
    const handleDownload = () => {
        if (window.saveAs && zipBlob) {
            window.saveAs(zipBlob, zipFilename);
            if (onDownload) {
                onDownload();
            }
        }
    };

    return (
        <div className="w-full h-full overflow-y-auto bg-gray-100 flex items-center justify-center">
            <div className="w-full max-w-xl mx-auto px-4 sm:px-8 py-10 sm:py-12 text-center">
                <div className="relative w-32 h-32 flex items-center justify-center mb-8 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-2xl shadow-green-500/30 opacity-80"></div>
                    <HardDriveDownload className="w-20 h-20 text-white relative" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 tracking-tight">画像の加工が完了しました！</h1>
                <p className="text-base sm:text-lg text-gray-500 mt-3">下のボタンをクリックして、ZIPファイルをダウンロードしてください。</p>
                <button
                    onClick={handleDownload}
                    className="mt-12 flex items-center justify-center w-full max-w-md mx-auto px-8 sm:px-12 py-4 rounded-2xl text-white bg-gradient-to-br from-green-500 to-emerald-600 
                               font-bold text-lg sm:text-xl shadow-2xl shadow-green-500/40
                               transform hover:-translate-y-1 transition-all duration-300 ease-in-out"
                >
                    <Download size={24} className="mr-3" />
                    <span>{zipFilename} をダウンロード</span>
                </button>
                <button
                    onClick={onRestart}
                    className="mt-10 flex items-center justify-center mx-auto px-6 py-2 rounded-lg text-gray-500 font-semibold hover:bg-gray-200/80 hover:text-gray-700 transition-colors"
                >
                    <RotateCcw size={16} className="mr-2" />
                    最初に戻る
                </button>
            </div>
        </div>
    );
};

/**
 * メインアプリケーションコンポーネント
 */
export default function App() {
    // ログ送信を有効にするかどうかのフラグ（開発モード時は無効化）
    const isLogSendingEnabled = true;

    const [screen, setScreen] = useState('initializing');
    const [isDownloadCompleted, setIsDownloadCompleted] = useState(false); 
    const [images, setImages] = useState([]);
    const [loadingProgress, setLoadingProgress] = useState({ progress: 0, total: 0 });
    const [processingProgress, setProcessingProgress] = useState({ progress: 0, total: 0 });
    const [zipBlob, setZipBlob] = useState(null);
    const [zipFilename, setZipFilename] = useState('');
    const [errors, setErrors] = useState([]);
    const [bulkSettings, setBulkSettings] = useState({ industryCode: '', submissionId: '', date: getFormattedDate(), quality: 9, startSequence: '1' });
    const [industryCodes, setIndustryCodes] = useState(INITIAL_INDUSTRY_CODES);
    const [spreadsheetMode, setSpreadsheetMode] = useState(() => localStorage.getItem('spreadsheetMode') || 'replace');
    const [spreadsheetUrl, setSpreadsheetUrl] = useState(() => localStorage.getItem('spreadsheetUrl') || '');
    const [fileTypeCounts, setFileTypeCounts] = useState({});
    const [timeBreakdown, setTimeBreakdown] = useState({ thumbnail: 0, resize: 0, zip: 0 });
    
    // === ▼▼▼ 通知システム用のstateを再定義（ここから）▼▼▼ ===
    const [allNotifications, setAllNotifications] = useState([]); // notifications.json の全データ
    const [notificationQueue, setNotificationQueue] = useState([]); // モーダルで表示する通知のキュー
    const [updateBannerNotifications, setUpdateBannerNotifications] = useState([]); // バナーで通知する更新情報
    const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false); // 更新履歴モーダルの表示状態
    // === ▲▲▲ 通知システム用のstateを再定義（ここまで）▲▲▲ ===

    // 開発モードかどうかを判定するstate
    const [isDevMode, setIsDevMode] = useState(false); 

    useEffect(() => {
        const devModeFlag = localStorage.getItem('developer_mode_enabled');
        if (devModeFlag === 'true') {
            setIsDevMode(true);
            document.title = `[DEV] ${document.title}`;
            console.log('%c[DEV MODE] ログ送信は無効化されています。', 'color: orange; font-weight: bold;');
        }

        window.enableDevMode = (password) => {
            if (password === 0) {
                localStorage.setItem('developer_mode_enabled', 'true');
                setIsDevMode(true);
                document.title = `[DEV] ${document.title}`;
                console.log('%c[DEV MODE] 有効化しました。これ以降のログは送信されません。', 'color: orange; font-weight: bold;');
                return "開発者モードが有効になりました。";
            } else {
                console.error('開発者モードのパスワードが違います。');
                return "パスワードが違います。";
            }
        };

        window.disableDevMode = () => {
            localStorage.removeItem('developer_mode_enabled');
            setIsDevMode(false);
            document.title = document.title.replace('[DEV] ', '');
            console.log('%c[DEV MODE] 無効化しました。これ以降のログは送信されます。', 'color: green; font-weight: bold;');
            return "開発者モードが無効になりました。";
        };

        return () => {
            delete window.enableDevMode;
            delete window.disableDevMode;
        };
    }, []); 

    const [uploadMethod, setUploadMethod] = useState('');
    const [totalFileSize, setTotalFileSize] = useState(0);
    const [sessionId] = useState(() => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
    const [processingStartTime, setProcessingStartTime] = useState(null);
    const [activeTimeInSeconds, setActiveTimeInSeconds] = useState(0);
    const mouseMovedRef = React.useRef(false);

    // 処理中かどうかのフラグ（重複処理防止用）
    const isProcessingRef = React.useRef(false);

    useEffect(() => {
        isProcessingRef.current = (screen === 'loading' || screen === 'processing');
    }, [screen]);

    useEffect(() => {
        const handleMouseMove = () => {
            mouseMovedRef.current = true;
        };
        window.addEventListener('mousemove', handleMouseMove);
        const intervalId = setInterval(() => {
            if (mouseMovedRef.current && !isProcessingRef.current) {
                setActiveTimeInSeconds(prevTime => prevTime + 1);
                mouseMovedRef.current = false;
            }
        }, 1000);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            clearInterval(intervalId);
        };
    }, []);

    // === ▼▼▼ 通知システムロジック START ▼▼▼ ===
    // 1. アプリ起動時に一度だけ通知データを取得する
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const response = await fetch("/notifications.json");
                if (!response.ok) return;
                const notifications = await response.json();
                setAllNotifications(notifications);
            } catch (err) {
                console.error("Failed to fetch notifications:", err);
            }
        };
        fetchNotifications();
    }, []);

    // 2. データ取得後、またはモーダルが閉じてキューが空になった時に、次に表示すべき通知を判断する
    useEffect(() => {
        // データ未ロード、または既にモーダル表示中の場合は何もしない
        if (allNotifications.length === 0 || notificationQueue.length > 0) {
            return;
        }

        const isFirstVisit = JSON.parse(localStorage.getItem('isFirstVisit')) !== false;
        if (isFirstVisit) {
            const welcome = allNotifications.find(n => n.type === 'welcome');
            if (welcome) setNotificationQueue([welcome]);
            return; // 初回訪問時はwelcome表示のみで処理を中断
        }

        // リピート訪問時の処理
        const seenIds = JSON.parse(localStorage.getItem("seenNotifications")) || [];
        const unseen = allNotifications.filter((n) => !seenIds.includes(n.id) && n.type !== 'welcome');

        const agreements = unseen.filter((n) => n.type === "agreement");
        if (agreements.length > 0) {
            setNotificationQueue(agreements); // 未同意の規約があればキューに入れる
            return;
        }

        const updates = unseen.filter((n) => n.type === "update");
        if (updates.length > 0) {
            setUpdateBannerNotifications(updates); // 未確認の更新があればバナー表示
        }
    }, [allNotifications, notificationQueue]); // データロード後、またはキューが空になった時に実行

    // 3. モーダルを閉じる際の汎用ハンドラ
    const handleCloseNotificationModal = (confirmed) => {
        // バナーから開いた更新履歴モーダルの場合
        if (isUpdateModalOpen) {
            if (confirmed) {
                const seenIds = JSON.parse(localStorage.getItem("seenNotifications")) || [];
                updateBannerNotifications.forEach((n) => {
                    if (!seenIds.includes(n.id)) seenIds.push(n.id);
                });
                localStorage.setItem("seenNotifications", JSON.stringify(seenIds));
            }
            setIsUpdateModalOpen(false);
            setUpdateBannerNotifications([]);
            return;
        }

        // キューから表示されたモーダル(welcome, agreement)の場合
        const currentNotification = notificationQueue[0];
        if (!currentNotification) return;

        if (confirmed) {
             const seenIds = JSON.parse(localStorage.getItem('seenNotifications')) || [];

            if (currentNotification.type === 'welcome') {
                localStorage.setItem('isFirstVisit', JSON.stringify(false));

                // welcome通知と、全てのupdate通知を既読にする
                const updateIds = allNotifications
                    .filter(n => n.type === 'update')
                    .map(n => n.id);
                
                const newSeenIds = [...new Set([...seenIds, currentNotification.id, ...updateIds])];
                localStorage.setItem('seenNotifications', JSON.stringify(newSeenIds));

            } else { // agreementの場合
                if (!seenIds.includes(currentNotification.id)) {
                    seenIds.push(currentNotification.id);
                    localStorage.setItem('seenNotifications', JSON.stringify(seenIds));
                }
            }
        }
        // 処理した通知をキューから削除（これにより、上記のuseEffectが再トリガーされる）
        setNotificationQueue(queue => queue.slice(1));
    };
    // === ▲▲▲ 通知システムロジック END ▲▲▲ ===


    const { isLoaded: isHeicLoaded, error: heicError } = useScript(HEIC_CDN_URL);
    const { isLoaded: isJszipLoaded, error: jszipError } = useScript(JSZIP_CDN);
    const { isLoaded: isFilesaverLoaded, error: filesaverError } = useScript(FILESAVER_CDN);

    const handleFileErrors = useCallback((newErrors) => {
        setErrors(newErrors);
        setTimeout(() => setErrors([]), 8000);
    }, []);

    const fetchIndustryCodes = useCallback(async (spreadsheetUrl, mode) => {
        const extractIdFromUrl = (url) => {
            if (!url) return null;
            const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            return match ? match[1] : null;
        };

        const spreadsheetId = extractIdFromUrl(spreadsheetUrl);

        if (!spreadsheetId) {
            localStorage.removeItem('spreadsheetUrl');
            localStorage.removeItem('spreadsheetMode');
            localStorage.removeItem('cachedIndustryCodes');
            setIndustryCodes(INITIAL_INDUSTRY_CODES);
            return;
        }

        try {
            const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A:B?key=${import.meta.env.VITE_GOOGLE_API_KEY}`);
            if (!response.ok) {
                throw new Error('スプレッドシートからのデータ取得に失敗しました。IDや共有設定を確認してください。');
            }

            const data = await response.json();
            const fetchedCodes = data.values
                ? data.values
                    .filter(row => row[0] && row[1])
                    .map(row => ({ code: row[0], name: row[1] }))
                : [];
            
            if (fetchedCodes.length > 0) {
                let finalCodes;
                if (mode === 'add') {
                    const combined = [...fetchedCodes, ...INITIAL_INDUSTRY_CODES];
                    const uniqueCodes = combined.filter((item, index, self) =>
                        index === self.findIndex((t) => t.code === item.code)
                    );
                    setIndustryCodes(uniqueCodes);
                    finalCodes = uniqueCodes;
                } else {
                    setIndustryCodes(fetchedCodes);
                    finalCodes = fetchedCodes;
                }
                localStorage.setItem('cachedIndustryCodes', JSON.stringify(finalCodes));

            } else {
                handleFileErrors(['シートから有効なデータを取得できませんでした。']);
                setIndustryCodes(INITIAL_INDUSTRY_CODES);
                localStorage.removeItem('cachedIndustryCodes');
            }
        } catch (error) {
            console.error("Failed to fetch industry codes:", error);
            handleFileErrors([error.message]);
            setIndustryCodes(INITIAL_INDUSTRY_CODES);
            localStorage.removeItem('cachedIndustryCodes');
        }
    }, [handleFileErrors]);

    useEffect(() => {
        const scriptErrors = [
            heicError && 'HEIC変換ライブラリ',
            jszipError && 'ZIP圧縮ライブラリ',
            filesaverError && 'ファイル保存ライブラリ'
        ].filter(Boolean);

        if (scriptErrors.length > 0) {
            handleFileErrors([`${scriptErrors.join(', ')}の読み込みに失敗しました。`]);
        }

        if (isHeicLoaded && isJszipLoaded && isFilesaverLoaded && screen === 'initializing') {
            setIndustryCodes(INITIAL_INDUSTRY_CODES);
            localStorage.removeItem('spreadsheetUrl');
            localStorage.removeItem('spreadsheetMode');
            localStorage.removeItem('cachedIndustryCodes');
            
            setScreen('upload');
        }
    }, [isHeicLoaded, isJszipLoaded, isFilesaverLoaded, heicError, jszipError, filesaverError, screen, handleFileErrors, fetchIndustryCodes]);

    const handleSpreadsheetConnection = async (url, mode) => {
        if (!url) {
            localStorage.removeItem('spreadsheetUrl');
            localStorage.removeItem('spreadsheetMode');
            setSpreadsheetUrl('');
            setSpreadsheetMode('replace');
            setIndustryCodes(INITIAL_INDUSTRY_CODES);
            return { status: 'success', message: '連携を解除しました。' };
        }
        return { status: 'error', message: '現在、スプレッドシート連携機能は利用できません。' };
    };

    const handleFilesAccepted = async (files, method) => {
        setUploadMethod(method);
        const totalSizeInBytes = files.reduce((sum, file) => sum + file.size, 0);
        const totalSizeInMB = totalSizeInBytes / (1024 * 1024);
        setTotalFileSize(totalSizeInMB);

        const counts = files.reduce((acc, file) => {
            const extension = file.name.split('.').pop().toLowerCase();
            if (extension === 'jpg' || extension === 'jpeg') {
                acc.jpg = (acc.jpg || 0) + 1;
            } else if (extension === 'png') {
                acc.png = (acc.png || 0) + 1;
            } else if (extension === 'heic' || extension === 'heif') {
                acc.heic = (acc.heic || 0) + 1;
            }
            return acc;
        }, {});
        setFileTypeCounts(counts);

        setScreen('loading');
        setErrors([]);
        setLoadingProgress({ progress: 0, total: files.length });

        const newImages = [];
        const thumbnailStartTime = performance.now();
        for (const file of files) {
            try {
                let blob = file;
                const lowerCaseName = file.name.toLowerCase();
                if ((lowerCaseName.endsWith('.heic') || lowerCaseName.endsWith('.heif')) && window.heic2any) {
                    blob = await window.heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
                }
                const originalUrl = URL.createObjectURL(blob);
                const thumbnailUrl = await createThumbnail(originalUrl);

                newImages.push({
                    id: `${file.name}-${Date.now()}-${Math.random()}`,
                    file,
                    originalUrl,
                    thumbnailUrl,
                    industryCode: '',
                    submissionId: '',
                    date: '',
                    quality: 9,
                });
            } catch (err) {
                console.error("Error processing file:", file.name, err);
                handleFileErrors([`ファイル処理中にエラーが発生しました: ${file.name}`]);
            }
            setLoadingProgress(p => ({ ...p, progress: p.progress + 1 }));
        }
        const thumbnailEndTime = performance.now();
        setTimeBreakdown(prev => ({ ...prev, thumbnail: (thumbnailEndTime - thumbnailStartTime) / 1000 }));
        setImages(newImages);
        setScreen('bulk-settings');
    };
    
    const handleBulkSettingsNext = () => {
        setImages(imgs => imgs.map(img => ({
            ...img,
            industryCode: bulkSettings.industryCode,
            submissionId: bulkSettings.submissionId,
            date: bulkSettings.date,
            quality: bulkSettings.quality,
        })));
        setScreen('confirm-edit');
    };

    const resizeWithPadding = (image, targetWidth, targetHeight) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                let currentCanvas = document.createElement('canvas');
                let currentCtx = currentCanvas.getContext('2d');
                currentCanvas.width = img.width;
                currentCanvas.height = img.height;
                currentCtx.drawImage(img, 0, 0);

                while (currentCanvas.width > targetWidth * 2) {
                    const nextWidth = Math.floor(currentCanvas.width / 2);
                    const nextHeight = Math.floor(currentCanvas.height / 2);
                    
                    if (nextWidth < targetWidth || nextHeight < targetHeight) break;

                    const nextCanvas = document.createElement('canvas');
                    nextCanvas.width = nextWidth;
                    nextCanvas.height = nextHeight;
                    const nextCtx = nextCanvas.getContext('2d');
                    
                    nextCtx.imageSmoothingQuality = 'high';
                    nextCtx.drawImage(currentCanvas, 0, 0, nextWidth, nextHeight);
                    
                    currentCanvas = nextCanvas;
                }

                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = targetWidth;
                finalCanvas.height = targetHeight;
                const ctx = finalCanvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
                ctx.imageSmoothingQuality = 'high';
                const imgAspect = currentCanvas.width / currentCanvas.height;
                const targetAspect = targetWidth / targetHeight;
                let drawWidth, drawHeight, x, y;

                if (imgAspect > targetAspect) {
                    drawWidth = targetWidth;
                    drawHeight = targetWidth / imgAspect;
                    x = 0;
                    y = (targetHeight - drawHeight) / 2;
                } else {
                    drawHeight = targetHeight;
                    drawWidth = targetHeight * imgAspect;
                    y = 0;
                    x = (targetWidth - drawWidth) / 2;
                }
                
                ctx.drawImage(currentCanvas, x, y, drawWidth, drawHeight);
                resolve(finalCanvas);
            };
            img.onerror = reject;
            img.src = image.originalUrl;
        });
    };

    const handleProcess = async () => {
        setProcessingStartTime(Date.now());

        setScreen('processing');
        setProcessingProgress({ progress: 0, total: images.length });
        const zip = new window.JSZip();

        const resizeStartTime = performance.now();
        const startSequenceNumber = parseInt(bulkSettings.startSequence, 10) || 1;

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                const canvas = await resizeWithPadding(image, RESIZE_WIDTH, RESIZE_HEIGHT);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', image.quality / 10));
                const sequence = String(i + startSequenceNumber).padStart(2, '0');
                const newFilename = `${image.industryCode}_${image.submissionId}_${image.date}_${sequence}.jpg`;
                zip.file(newFilename, blob);

            } catch (err) {
                console.error("Error processing image:", image.file.name, err);
                handleFileErrors([`画像処理エラー: ${image.file.name}`]);
            }
            setProcessingProgress(p => ({ ...p, progress: p.progress + 1 }));
        }

        const resizeEndTime = performance.now();
        const zipStartTime = performance.now();
        const zipFile = await zip.generateAsync({ type: 'blob' });
        const zipEndTime = performance.now();
        
        setTimeBreakdown(prev => ({
            ...prev,
            resize: (resizeEndTime - resizeStartTime) / 1000,
            zip: (zipEndTime - zipStartTime) / 1000
        }));
        setZipBlob(zipFile);
        
        const firstImage = images[0];
        if (firstImage) {
            setZipFilename(`${firstImage.industryCode}_${firstImage.submissionId}.zip`);
        } else {
            setZipFilename('processed_images.zip');
        }
        
        setScreen('download');
    };

    const handleDownload = async () => {
        setIsDownloadCompleted(true);
        
        if (isLogSendingEnabled && !isDevMode && processingStartTime) {
            try {
                const processingTime = (Date.now() - processingStartTime) / 1000;
                
                const logData = {
                    sessionId: sessionId,
                    eventTimestamp: serverTimestamp(),
                    fileCount: images.length,
                    processingTime: processingTime,
                    usedIndustryCode: bulkSettings.industryCode,
                    submissionId: bulkSettings.submissionId, 
                    errors: [],
                    userAgent: navigator.userAgent,
                    fileTypeCounts: fileTypeCounts,
                    timeBreakdown: timeBreakdown,
                    uploadMethod: uploadMethod,
                    totalFileSize: totalFileSize,
                    sessionDuration: activeTimeInSeconds,
                    isStartSequenceCustomized: bulkSettings.startSequence !== '1', 
                };

                await addDoc(collection(db, "usage_logs"), logData);
                console.log("Log successfully sent to Firestore.");

            } catch (e) {
                console.error("Error adding document to Firestore: ", e);
            }
        }
    };
    
    const handleRestart = () => {
        images.forEach(image => {
            URL.revokeObjectURL(image.originalUrl);
            URL.revokeObjectURL(image.thumbnailUrl);
        });
        setImages([]);
        setZipBlob(null);
        setZipFilename('');
        setErrors([]);
        setBulkSettings({ industryCode: '', submissionId: '', date: getFormattedDate(), quality: 9, startSequence: '1' });
        setIsDownloadCompleted(false);
        setProcessingStartTime(null);

        setActiveTimeInSeconds(0);
        setUploadMethod('');
        setTotalFileSize(0);
        setFileTypeCounts({});
        setTimeBreakdown({ thumbnail: 0, resize: 0, zip: 0 });
        
        setScreen('upload');
    };

    const workflowSteps = [
        { id: 'upload', name: 'アップロード' },
        { id: 'bulk-settings', name: 'ファイル名設定' },
        { id: 'confirm-edit', name: '確認' },
        { id: 'download', name: 'ダウンロード' },
    ];

    const getCurrentStep = () => {
        if (isDownloadCompleted) return 5;

        switch (screen) {
            case 'upload':
            case 'loading':
                return 1;
            case 'bulk-settings':
                return 2;
            case 'confirm-edit':
            case 'processing':
                return 3;
            case 'download':
                return 4;
            default:
                return 0;
        }
    };
    const currentStep = getCurrentStep();
    const isLoading = screen === 'loading' || screen === 'processing';

    const renderScreen = () => {
        switch (screen) {
            case 'initializing': return <LoadingScreen title="ライブラリを準備中..." />;
            case 'loading': return <LoadingScreen title="画像を読み込んでいます..." progress={loadingProgress.progress} total={loadingProgress.total} />;
            case 'bulk-settings': return <BulkSettingsScreen onNext={handleBulkSettingsNext} onBack={handleRestart} bulkSettings={bulkSettings} setBulkSettings={setBulkSettings} industryCodes={industryCodes} onConnect={handleSpreadsheetConnection} spreadsheetUrl={spreadsheetUrl} spreadsheetMode={spreadsheetMode} />;
            case 'confirm-edit': return <ConfirmEditScreen images={images} setImages={setImages} onProcess={handleProcess} onBack={() => setScreen('bulk-settings')} industryCodes={industryCodes} bulkSettings={bulkSettings} />;
            case 'processing': return <LoadingScreen title="画像を処理中です..." progress={processingProgress.progress} total={processingProgress.total} />;
            case 'download': return <DownloadScreen zipBlob={zipBlob} zipFilename={zipFilename} onRestart={handleRestart} onDownload={handleDownload} />;
            case 'upload':
            default:
                return <UploadScreen onFilesAccepted={handleFilesAccepted} setErrors={handleFileErrors} />;
        }
    };

    const showModal = notificationQueue.length > 0 || isUpdateModalOpen;

    return (
        <div className="font-sans w-full h-dvh flex flex-col antialiased bg-gray-100">
            {screen !== 'initializing' && <AppHeader currentStep={currentStep} steps={workflowSteps} isLoading={isLoading} />}
            
            <div className="flex-grow relative min-h-0 flex flex-col">
                <div className="absolute top-4 left-4 right-4 z-50 space-y-2 w-auto max-w-full">
                    {errors.map((error, index) => (
                        <Alert key={index} message={error} onDismiss={() => setErrors(prev => prev.filter((_, i) => i !== index))} />
                    ))}
                </div>
                
                {/* === ▼▼▼ レンダーロジックを更新（ここから）▼▼▼ === */}
                <div className={`flex-grow flex flex-col transition-all duration-300 ${showModal ? 'filter blur-sm pointer-events-none' : ''}`}>
                    {renderScreen()}
                </div>
                
                <div className="absolute top-4 right-4 z-20">
                    {screen === "upload" && updateBannerNotifications.length > 0 && (
                        <UpdateBanner
                          latestUpdate={
                            [...updateBannerNotifications].sort((a, b) => new Date(b.content.date) - new Date(a.content.date))[0]
                          }
                          onOpen={() => setIsUpdateModalOpen(true)}
                        />
                    )}
                </div>
                
                {notificationQueue.length > 0 && (
                     <NotificationModal
                        notifications={[notificationQueue[0]]}
                        onClose={handleCloseNotificationModal}
                    />
                )}

                {isUpdateModalOpen && (
                    <NotificationModal
                        notifications={updateBannerNotifications}
                        onClose={handleCloseNotificationModal}
                    />
                )}
                {/* === ▲▲▲ レンダーロジックを更新（ここまで）▲▲▲ === */}
            </div>
        </div>
    );
}

