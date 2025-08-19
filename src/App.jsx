import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, ChevronsRight, Download, RotateCcw, Settings, X, AlertCircle, Loader, HardDriveDownload, Copy, Check } from 'lucide-react';

// === CDN & ライブラリの定義 ===

// 外部ライブラリのCDN URL
const HEIC_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const FILESAVER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';

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
const AppHeader = ({ currentStep, steps }) => {
  return (
    <header className="relative bg-white/80 backdrop-blur-lg border-b border-gray-200/80 px-6 py-3 flex items-center justify-between flex-shrink-0 h-20 z-10">
      {/* App Title */}
      <div className="text-lg font-bold text-gray-800">
        業種別リネーム＆加工ツール
      </div>

      {/* Workflow Steps (Centered) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex items-center">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isCompleted = currentStep > stepNumber;
            const isCurrent = currentStep === stepNumber;

            return (
              <React.Fragment key={step.id}>
                {/* Step Circle and Text */}
                <div className="flex flex-col items-center w-24">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 border-2
                      ${isCompleted ? 'bg-blue-500 border-blue-500 text-white' : ''}
                      ${isCurrent ? 'bg-white border-blue-500 text-blue-600 ring-4 ring-blue-500/20' : ''}
                      ${!isCompleted && !isCurrent ? 'bg-gray-100 border-gray-300 text-gray-400' : ''}
                    `}
                  >
                    {isCompleted ? <Check size={18} /> : stepNumber}
                  </div>
                  <span className={`mt-2 text-xs font-semibold transition-colors duration-300 ${isCurrent ? 'text-blue-600' : 'text-gray-500'}`}>
                    {step.name}
                  </span>
                </div>

                {/* Connector Line */}
                {index < steps.length - 1 && (
                  <div className={`w-16 h-1 -mx-4 mb-6 transition-colors duration-300 rounded-full
                    ${currentStep > stepNumber ? 'bg-blue-400' : 'bg-gray-300'}
                  `} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right side spacer to balance the title */}
      <div className="w-48"></div>
    </header>
  );
};


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
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
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
      onFilesAccepted(acceptedFiles);
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
    <div {...getRootProps()} className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-100 relative">
      <input {...getInputProps()} />
      <div className="max-w-3xl w-full">
        <h1 className="text-5xl font-bold text-gray-800 tracking-tight">
          画像ファイルをアップロード
        </h1>
        <p className="text-lg text-gray-500 mt-4 mb-12">
          加工したいファイルをドラッグ＆ドロップするか、ボタンから選択してください。
        </p>
        <div 
          className="relative w-full h-96 rounded-3xl flex flex-col items-center justify-center 
                     bg-white/60 backdrop-blur-xl border border-gray-200/50 shadow-xl"
        >
          <div className="text-center">
            <UploadCloud className="w-20 h-20 text-gray-400 mx-auto" />
            <p className="mt-6 text-xl font-medium text-gray-700">
              この画面のどこかにファイルをドラッグ＆ドロップ
            </p>
            <p className="mt-2 text-sm text-gray-500">または</p>
            <button 
              type="button" 
              onClick={(e) => {
                  e.stopPropagation();
                  open();
              }} 
              className="mt-6 px-8 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg 
                         hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-200"
            >
              ファイルを選択
            </button>
          </div>
          <div className="absolute bottom-6 text-center w-full text-xs text-gray-500">
            <p>対応: JPG, PNG, HEIC  |  サイズ: 10MBまで  |  上限: 50枚</p>
          </div>
        </div>
      </div>
      {isDragActive && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center 
                       bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out">
          <UploadCloud className="w-32 h-32 text-white/90 animate-bounce" />
          <p className="mt-8 text-4xl font-bold text-white">
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
const IndustryManagementModal = ({ isOpen, onClose, spreadsheetId, setSpreadsheetId, onTestConnection, testResult }) => {
    const [localId, setLocalId] = useState(spreadsheetId);
    const [isCopied, setIsCopied] = useState(false);

    useEffect(() => {
        setLocalId(spreadsheetId);
    }, [spreadsheetId]);

    if (!isOpen) return null;

    const handleSave = () => {
        setSpreadsheetId(localId);
        onClose();
    };
    
    const handleCopy = () => {
        const email = "service-account-email@developer.gserviceaccount.com";
        navigator.clipboard.writeText(email).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
            <div className="bg-white/95 backdrop-blur-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl">
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
                        <h3 className="text-lg font-semibold mb-3">連携マニュアル</h3>
                        <ol className="list-decimal list-inside space-y-4 bg-white/50 p-5 rounded-xl border border-gray-200 text-sm">
                            <li>A列に業種コード、B列に業種名を入力したGoogleスプレッドシートを作成します。</li>
                            <li>
                                以下のサービスアカウントを、そのシートの「<strong className="text-blue-600 font-semibold">編集者</strong>」として共有追加してください。
                                <div className="flex items-center gap-2 my-2 p-3 bg-gray-100/90 border border-gray-200/80 rounded-lg">
                                    <code className="flex-grow text-blue-600 font-mono text-xs">service-account-email@developer.gserviceaccount.com</code>
                                    <button onClick={handleCopy} className="flex-shrink-0 flex items-center text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-200/70 hover:border-gray-400/80 transition">
                                        {isCopied ? <Check size={14} className="text-green-500"/> : <Copy size={14} />}
                                        <span className="ml-1.5">{isCopied ? 'コピー完了' : 'コピー'}</span>
                                    </button>
                                </div>
                            </li>
                            <li>共有したスプレッドシートのIDを入力してください。<br/>
                                <span className="text-xs text-gray-500">(URLの `.../d/` と `/...` の間の部分です)</span>
                            </li>
                        </ol>
                    </div>
                    <div>
                        <label htmlFor="spreadsheetIdModal" className="text-base font-semibold mb-3 block">スプレッドシートID:</label>
                        <div className="flex gap-3">
                            <input
                                id="spreadsheetIdModal"
                                type="text"
                                value={localId}
                                onChange={(e) => setLocalId(e.target.value)}
                                placeholder="スプレッドシートIDを貼り付け"
                                className="flex-grow px-4 py-3 bg-white/80 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                            />
                            <button onClick={() => onTestConnection(localId)} className="px-5 py-3 bg-blue-600 text-white font-bold rounded-xl shadow-md hover:bg-blue-700 transition whitespace-nowrap">接続テスト</button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-3">プレビュー</h3>
                        <div className="p-4 bg-white/50 rounded-xl min-h-[100px] border border-gray-200">
                           {testResult.status === 'testing' && <p className="text-gray-500">テスト中...</p>}
                           {testResult.status === 'success' && (
                               <div>
                                   <p className="text-green-600 font-bold mb-2 flex items-center"><Check className="mr-2"/>正常に連携できました。</p>
                                   <ul className="list-disc list-inside text-sm text-gray-800">
                                       {testResult.data.slice(0, 5).map(item => <li key={item.code}>{item.code}: {item.name}</li>)}
                                       {testResult.data.length > 5 && <li>...他{testResult.data.length - 5}件</li>}
                                   </ul>
                               </div>
                           )}
                           {testResult.status === 'error' && <p className="text-red-600 font-bold flex items-center"><AlertCircle className="mr-2"/>{testResult.message}</p>}
                           {testResult.status === 'idle' && <p className="text-gray-500">接続テストボタンを押して、連携を確認してください。</p>}
                        </div>
                    </div>
                </main>
                <footer className="flex justify-end p-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-6 py-2 mr-4 rounded-lg font-semibold text-gray-700 bg-gray-200/70 hover:bg-gray-300/70 transition">キャンセル</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-lg text-white font-bold bg-blue-600 hover:bg-blue-700 shadow-md transition">保存して閉じる</button>
                </footer>
            </div>
        </div>
    );
};

/**
 * STEP 2: 一括設定画面
 */
const BulkSettingsScreen = ({ onNext, onBack, bulkSettings, setBulkSettings, industryCodes }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [spreadsheetId, setSpreadsheetId] = useState(() => localStorage.getItem('spreadsheetId') || '');
    const [testResult, setTestResult] = useState({ status: 'idle', data: [], message: '' });

    const handleTestConnection = async (id) => {
        setTestResult({ status: 'testing', data: [], message: '' });
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (id === 'correct-id-for-demo') {
            const mockData = [
                { code: 'demo_hos', name: 'デモ病院' },
                { code: 'demo_htl', name: 'デモホテル' },
                { code: 'demo_sal', name: 'デモサロン' },
            ];
            setTestResult({ status: 'success', data: mockData, message: '' });
        } else {
            setTestResult({ status: 'error', data: [], message: '連携に失敗しました。IDと共有設定を確認してください。' });
        }
    };

    const handleIdSave = (newId) => {
        setSpreadsheetId(newId);
        localStorage.setItem('spreadsheetId', newId);
    };
    
    // 全角数字を半角に変換する関数
    const toHalfWidth = (str) => {
      return str.replace(/[０-９]/g, (s) => {
        return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
      });
    };

    const isNextDisabled = !bulkSettings.industryCode || !/^\d+$/.test(bulkSettings.submissionId) || !/^\d{8}$/.test(bulkSettings.date);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-100">
            <div className="w-full max-w-xl">
                <h2 className="text-4xl font-bold text-center text-gray-800 tracking-tight">一括設定</h2>
                <p className="text-center text-lg text-gray-500 mt-3 mb-10">リネーム後のファイル名に使われる基本情報を設定します。</p>
                <div className="bg-white/60 backdrop-blur-xl border border-gray-200/50 shadow-xl rounded-3xl p-8 space-y-8">
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
                            <button 
                                onClick={() => setIsModalOpen(true)}
                                className="flex-shrink-0 flex items-center px-4 py-3 bg-gray-200/80 text-gray-700 font-semibold rounded-xl hover:bg-gray-300/80 transition"
                            >
                                <Settings size={18} className="mr-2" />
                                <span>管理</span>
                            </button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="submissionId" className="block text-base font-semibold text-gray-700 mb-3">入稿ID</label>
                        <input
                            id="submissionId"
                            type="text"
                            value={bulkSettings.submissionId}
                            // ★ ここから修正
                            onChange={(e) => {
                                // 入力値から半角数字以外の文字をすべて取り除く
                                const numericValue = e.target.value.replace(/[^0-9]/g, '');
                                setBulkSettings(p => ({ ...p, submissionId: numericValue }));
                            }}
                            // ★ ここまで修正
                            placeholder="例: 12345"
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                        <p className="text-xs text-gray-500 mt-2">※半角数字で入力してください</p>
                    </div>

                    

                    <div>
                        <label htmlFor="date" className="block text-base font-semibold text-gray-700 mb-3">日付</label>
                        <input
                            id="date"
                            type="text"
                            value={bulkSettings.date}
                            onChange={(e) => {
                                // 半角数字以外を取り除き、先頭から8文字だけを切り出す
                                const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                setBulkSettings(p => ({ ...p, date: numericValue }))
                            }}
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                         <p className="text-xs text-gray-500 mt-2">※YYYYMMDD形式（8桁）で入力してください</p>
                    </div>

                    {/*
                    <div>
                        <label htmlFor="quality" className="block text-base font-semibold text-gray-700 mb-3">
                            画質: <span className="font-bold text-blue-600">{bulkSettings.quality.toFixed(1)}</span>
                        </label>
                        <input
                            id="quality"
                            type="range"
                            min="1"
                            max="10"
                            step="0.1"
                            value={bulkSettings.quality}
                            onChange={(e) => setBulkSettings(p => ({ ...p, quality: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-gray-200/80 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>低画質 (1.0)</span>
                            <span>高画質 (10.0)</span>
                        </div>
                    </div>
                    */}
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
                onClose={() => setIsModalOpen(false)}
                spreadsheetId={spreadsheetId}
                setSpreadsheetId={handleIdSave}
                onTestConnection={handleTestConnection}
                testResult={testResult}
            />
        </div>
    );
};

/**
 * STEP 3: 確認・個別編集画面
 */
const ConfirmEditScreen = ({ images, setImages, onProcess, onBack, industryCodes }) => {
    const [selectedImageId, setSelectedImageId] = useState(null);

    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        }
    }, [images, selectedImageId]);

    const handleIndividualChange = (id, field, value) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, [field]: value } : img));
    };

    const selectedImage = images.find(img => img.id === selectedImageId);
    
    const generateNewFilename = (image) => {
        const sequence = String(images.findIndex(img => img.id === image.id) + 1).padStart(2, '0');
        const extension = 'jpg';
        return `${image.industryCode}_${image.submissionId}_${image.date}_${sequence}.${extension}`;
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-100">
            <main className="flex-grow flex min-h-0">
                {/* Left Panel: Image List */}
                <div className="w-3/5 border-r border-gray-200/80 overflow-y-auto p-4 space-y-3">
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
                            <img src={image.thumbnailUrl} alt={image.file.name} className="w-20 h-20 object-contain rounded-lg bg-gray-100/80 flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <p className="text-xs text-gray-500 truncate" title={image.file.name}>{image.file.name}</p>
                                <p className="font-bold text-sm text-blue-600 truncate" title={generateNewFilename(image)}>{generateNewFilename(image)}</p>
                                <p className="text-xs text-gray-500 mt-1">出力サイズ: {RESIZE_WIDTH} x {RESIZE_HEIGHT} px</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Right Panel: Editor */}
                <div className="w-2/5 flex flex-col bg-white/30">
                    <div className="flex-grow p-6 space-y-6 overflow-y-auto">
                        <h3 className="text-xl font-semibold text-gray-800 pb-2">選択中画像の編集</h3>
                        {selectedImage ? (
                            <div className="space-y-6">
                                <div className="bg-gray-900/5 p-3 rounded-xl">
                                    <p className="text-xs font-semibold text-gray-600">元ファイル名</p>
                                    <p className="text-sm text-gray-800 truncate mt-1">{selectedImage.file.name}</p>
                                </div>

                                <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">業種</label>
                                    <select
                                        value={selectedImage.industryCode}
                                        onChange={(e) => handleIndividualChange(selectedImage.id, 'industryCode', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/80 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    >
                                        {industryCodes.map(ic => <option key={ic.code} value={ic.code}>{ic.name} ({ic.code})</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">入稿ID</label>
                                    <input
                                        type="text"
                                        value={selectedImage.submissionId}
                                        onChange={(e) => handleIndividualChange(selectedImage.id, 'submissionId', e.target.value)}
                                        className="w-full px-4 py-3 bg-white/80 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>
                                 <div>
                                    <label className="block text-base font-semibold text-gray-700 mb-3">日付</label>
                                    <input
                                        type="text"
                                        value={selectedImage.date}
                                        onChange={(e) => {
                                            // 半角数字以外を取り除き、先頭から8文字だけを切り出す
                                            const numericValue = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                                            handleIndividualChange(selectedImage.id, 'date', numericValue)
                                        }}
                                        className="w-full px-4 py-3 bg-white/80 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                                    />
                                </div>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center mt-10">リストから画像を選択してください</p>
                        )}
                    </div>
                    <footer className="p-4 flex justify-between items-center flex-shrink-0 border-t border-gray-200/80">
                        <button onClick={onBack} className="flex items-center px-6 py-3 rounded-xl text-gray-700 font-semibold bg-gray-200 hover:bg-gray-300 transition">
                            <RotateCcw size={18} className="mr-2" /> 戻る
                        </button>
                        <button onClick={onProcess} className="flex items-center px-6 py-3 rounded-xl text-white font-bold bg-blue-600 hover:bg-blue-700 transform hover:-translate-y-0.5 transition-all duration-200 shadow-lg">
                            加工に進む <ChevronsRight size={20} className="ml-2" />
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    );
};

/**
 * STEP 4: ダウンロード画面
 */
const DownloadScreen = ({ zipBlob, zipFilename, onRestart }) => {
    const handleDownload = () => {
        if (window.saveAs && zipBlob) {
            window.saveAs(zipBlob, zipFilename);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-gray-100">
            <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-2xl shadow-green-500/30 opacity-80"></div>
                <HardDriveDownload className="w-20 h-20 text-white relative" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight">画像の加工が完了しました！</h1>
            <p className="text-lg text-gray-500 mt-3">下のボタンをクリックして、ZIPファイルをダウンロードしてください。</p>
            <button
                onClick={handleDownload}
                className="mt-12 flex items-center px-12 py-4 rounded-2xl text-white bg-gradient-to-br from-green-500 to-emerald-600 
                           font-bold text-xl shadow-2xl shadow-green-500/40
                           transform hover:-translate-y-1 transition-all duration-300 ease-in-out"
            >
                <Download size={24} className="mr-3" />
                {zipFilename} をダウンロード
            </button>
            <button
                onClick={onRestart}
                className="mt-10 flex items-center px-6 py-2 rounded-lg text-gray-500 font-semibold hover:bg-gray-200/80 hover:text-gray-700 transition-colors"
            >
                <RotateCcw size={16} className="mr-2" />
                最初に戻る
            </button>
        </div>
    );
};

/**
 * メインアプリケーションコンポーネント
 */
export default function App() {
    const [screen, setScreen] = useState('initializing');
    const [images, setImages] = useState([]);
    const [loadingProgress, setLoadingProgress] = useState({ progress: 0, total: 0 });
    const [processingProgress, setProcessingProgress] = useState({ progress: 0, total: 0 });
    const [zipBlob, setZipBlob] = useState(null);
    const [zipFilename, setZipFilename] = useState('');
    const [errors, setErrors] = useState([]);
    const [bulkSettings, setBulkSettings] = useState({ industryCode: '', submissionId: '', date: getFormattedDate(), quality: 9 });
    const [industryCodes, setIndustryCodes] = useState(INITIAL_INDUSTRY_CODES);
    
    const { isLoaded: isHeicLoaded, error: heicError } = useScript(HEIC_CDN_URL);
    const { isLoaded: isJszipLoaded, error: jszipError } = useScript(JSZIP_CDN);
    const { isLoaded: isFilesaverLoaded, error: filesaverError } = useScript(FILESAVER_CDN);

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
            setScreen('upload');
        }
    }, [isHeicLoaded, isJszipLoaded, isFilesaverLoaded, heicError, jszipError, filesaverError, screen]);

    const handleFileErrors = (newErrors) => {
        setErrors(newErrors);
        setTimeout(() => setErrors([]), 8000);
    };

    const handleFilesAccepted = async (files) => {
        setScreen('loading');
        setErrors([]);
        setLoadingProgress({ progress: 0, total: files.length });

        const newImages = [];
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
                const canvas = document.createElement('canvas');
                canvas.width = targetWidth;
                canvas.height = targetHeight;
                const ctx = canvas.getContext('2d');

                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);

                const imgAspect = img.width / img.height;
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
                ctx.drawImage(img, x, y, drawWidth, drawHeight);
                resolve(canvas);
            };
            img.onerror = reject;
            img.src = image.originalUrl;
        });
    };

    const handleProcess = async () => {
        setScreen('processing');
        setProcessingProgress({ progress: 0, total: images.length });
        const zip = new window.JSZip();

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                const canvas = await resizeWithPadding(image, RESIZE_WIDTH, RESIZE_HEIGHT);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', image.quality / 10));
                
                const sequence = String(i + 1).padStart(2, '0');
                const newFilename = `${image.industryCode}_${image.submissionId}_${image.date}_${sequence}.jpg`;
                
                zip.file(newFilename, blob);

            } catch (err) {
                console.error("Error processing image:", image.file.name, err);
                handleFileErrors([`画像処理エラー: ${image.file.name}`]);
            }
            setProcessingProgress(p => ({ ...p, progress: p.progress + 1 }));
        }

        const zipFile = await zip.generateAsync({ type: 'blob' });
        setZipBlob(zipFile);
        
        const firstImage = images[0];
        if (firstImage) {
            setZipFilename(`${firstImage.industryCode}_${firstImage.submissionId}.zip`);
        } else {
            setZipFilename('processed_images.zip');
        }
        
        setScreen('download');
    };

    const handleRestart = () => {
        images.forEach(image => URL.revokeObjectURL(image.originalUrl));
        setImages([]);
        setZipBlob(null);
        setZipFilename('');
        setErrors([]);
        setBulkSettings({ industryCode: '', submissionId: '', date: getFormattedDate(), quality: 9 });
        setScreen('upload');
    };

    // ワークフローのステップを定義
    const workflowSteps = [
        { id: 'upload', name: 'アップロード' },
        { id: 'bulk-settings', name: '一括設定' },
        { id: 'confirm-edit', name: '確認・編集' },
        { id: 'download', name: 'ダウンロード' },
    ];

    // 現在の画面状態から、ワークフローのステップ番号を決定
    const getCurrentStep = () => {
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
                return 0; // 初期化中などはヘッダーを表示しない
        }
    };
    const currentStep = getCurrentStep();

    const renderScreen = () => {
        switch (screen) {
            case 'initializing': return <LoadingScreen title="ライブラリを準備中..." />;
            case 'loading': return <LoadingScreen title="画像を読み込んでいます..." progress={loadingProgress.progress} total={loadingProgress.total} />;
            case 'bulk-settings': return <BulkSettingsScreen onNext={handleBulkSettingsNext} onBack={handleRestart} bulkSettings={bulkSettings} setBulkSettings={setBulkSettings} industryCodes={industryCodes} />;
            case 'confirm-edit': return <ConfirmEditScreen images={images} setImages={setImages} onProcess={handleProcess} onBack={() => setScreen('bulk-settings')} industryCodes={industryCodes} />;
            case 'processing': return <LoadingScreen title="画像を処理中です..." progress={processingProgress.progress} total={processingProgress.total} />;
            case 'download': return <DownloadScreen zipBlob={zipBlob} zipFilename={zipFilename} onRestart={handleRestart} />;
            case 'upload':
            default:
                return <UploadScreen onFilesAccepted={handleFilesAccepted} setErrors={handleFileErrors} />;
        }
    };

    return (
        <div className="font-sans w-full h-screen flex flex-col antialiased bg-gray-100">
            {/* 初期化画面以外でヘッダーを表示 */}
            {screen !== 'initializing' && <AppHeader currentStep={currentStep} steps={workflowSteps} />}
            
            <div className="flex-grow relative min-h-0 flex flex-col">
                <div className="absolute top-4 left-4 right-4 z-50 space-y-2">
                    {errors.map((error, index) => (
                        <Alert key={index} message={error} onDismiss={() => setErrors(prev => prev.filter((_, i) => i !== index))} />
                    ))}
                </div>
                {renderScreen()}
            </div>
        </div>
    );
}
