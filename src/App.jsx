import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Scissors, ChevronsRight, Download, RotateCcw, Settings, X, FileText, HardDriveDownload, AlertCircle, Loader, BookOpen, Copy, Check, Server } from 'lucide-react';

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
      {/* より洗練されたローダー */}
      <div className="w-28 h-28 bg-white/70 backdrop-blur-lg rounded-full flex items-center justify-center shadow-lg">
        <Loader className="w-16 h-16 text-blue-500 animate-spin" />
      </div>
    </div>

    {/* ステータス表示 */}
    <h2 className="text-2xl font-semibold mt-10 text-gray-700 tracking-wide">
      {title}
    </h2>

    {/* プログレスバーと進捗件数 */}
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
    noClick: true, // 画面のどこかをクリックしてもファイル選択ダイアログは開かない
    noKeyboard: true,
  });

  return (
    // getRootPropsを最も外側のdivに適用し、画面全体をドロップゾーンにする
    <div {...getRootProps()} className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gray-100 relative">
      
      {/* useDropzoneに必要な非表示のinput要素 */}
      <input {...getInputProps()} />

      {/* 通常時のUIコンテンツ */}
      <div className="max-w-3xl w-full">
        <h1 className="text-5xl font-bold text-gray-800 tracking-tight">
          業種別リネーム＆加工ツール
        </h1>
        <p className="text-lg text-gray-500 mt-4 mb-12">
          複数の画像をまとめてリネーム・リサイズします。
        </p>

        {/* 中央のボックスは視覚的な要素となり、ドロップゾーンの役割は持たない */}
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
                  e.stopPropagation(); // 親要素へのイベント伝播を停止
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

      {/* isDragActiveがtrueの時に表示される全画面オーバーレイ */}
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
            {/* 全体をより明るい白に変更 */}
            <div className="bg-white/95 backdrop-blur-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl shadow-2xl">
                {/* 区切り線を明るい色に */}
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
                        {/* 背景を白ベースに、区切り線も明るく */}
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

    const isNextDisabled = !bulkSettings.industryCode || !/^\d+$/.test(bulkSettings.submissionId);

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
                            onChange={(e) => setBulkSettings(p => ({ ...p, submissionId: e.target.value }))}
                            placeholder="例: 12345"
                            className="w-full px-4 py-3 bg-white/50 border border-gray-300/50 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                        />
                        <p className="text-xs text-gray-500 mt-2">※半角数字で入力してください</p>
                    </div>
                    <div>
                        <label className="block text-base font-semibold text-gray-700 mb-3">日付</label>
                        <p className="w-full px-4 py-3 bg-gray-200/50 text-gray-800 rounded-xl">
                            {getFormattedDate()} <span className="text-sm text-gray-500">(処理日の日付が自動入力されます)</span>
                        </p>
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
        const dateStr = getFormattedDate();
        const sequence = String(images.findIndex(img => img.id === image.id) + 1).padStart(2, '0');
        const extension = 'jpg';
        return `${image.industryCode}_${image.submissionId}_${dateStr}_${sequence}.${extension}`;
    };

    return (
        <div className="w-full h-full flex flex-col bg-gray-100">
            <header className="p-5 flex-shrink-0">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">STEP 3/4: 確認・個別編集</h2>
            </header>
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
                {/* Icon background with gradient and shadow */}
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full shadow-2xl shadow-green-500/30 opacity-80"></div>
                {/* Icon */}
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
    const [screen, setScreen] = useState('initializing'); // 'initializing', 'upload', 'loading', 'bulk-settings', 'confirm-edit', 'processing', 'download'
    const [images, setImages] = useState([]);
    const [loadingProgress, setLoadingProgress] = useState({ progress: 0, total: 0 });
    const [processingProgress, setProcessingProgress] = useState({ progress: 0, total: 0 });
    const [zipBlob, setZipBlob] = useState(null);
    const [zipFilename, setZipFilename] = useState('');
    const [errors, setErrors] = useState([]);
    const [bulkSettings, setBulkSettings] = useState({ industryCode: '', submissionId: '' });
    const [industryCodes, setIndustryCodes] = useState(INITIAL_INDUSTRY_CODES);
    
    // 外部スクリプトの読み込み
    const { isLoaded: isHeicLoaded, error: heicError } = useScript(HEIC_CDN_URL);
    const { isLoaded: isJszipLoaded, error: jszipError } = useScript(JSZIP_CDN);
    const { isLoaded: isFilesaverLoaded, error: filesaverError } = useScript(FILESAVER_CDN);

    // スクリプト読み込み完了チェック
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

    // エラーメッセージのハンドリング
    const handleFileErrors = (newErrors) => {
        setErrors(newErrors);
        setTimeout(() => setErrors([]), 8000);
    };

    // ファイルアップロード処理
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
                    industryCode: '', // 後で一括設定
                    submissionId: '', // 後で一括設定
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
    
    // 一括設定完了後、各画像に設定を反映
    const handleBulkSettingsNext = () => {
        setImages(imgs => imgs.map(img => ({
            ...img,
            industryCode: bulkSettings.industryCode,
            submissionId: bulkSettings.submissionId,
        })));
        setScreen('confirm-edit');
    };

    // 画像のリサイズ処理（白背景でパディング）
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

    // 最終的な加工とZIP化処理
    const handleProcess = async () => {
        setScreen('processing');
        setProcessingProgress({ progress: 0, total: images.length });
        const zip = new window.JSZip();
        const dateStr = getFormattedDate();

        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            try {
                const canvas = await resizeWithPadding(image, RESIZE_WIDTH, RESIZE_HEIGHT);
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
                
                const sequence = String(i + 1).padStart(2, '0');
                const newFilename = `${image.industryCode}_${image.submissionId}_${dateStr}_${sequence}.jpg`;
                
                zip.file(newFilename, blob);

            } catch (err) {
                console.error("Error processing image:", image.file.name, err);
                handleFileErrors([`画像処理エラー: ${image.file.name}`]);
            }
            setProcessingProgress(p => ({ ...p, progress: p.progress + 1 }));
        }

        const zipFile = await zip.generateAsync({ type: 'blob' });
        setZipBlob(zipFile);
        
        // ZIPファイル名を決定（最初の画像の業種とIDを使用）
        const firstImage = images[0];
        if (firstImage) {
            setZipFilename(`${firstImage.industryCode}_${firstImage.submissionId}.zip`);
        } else {
            setZipFilename('processed_images.zip');
        }
        
        setScreen('download');
    };

    // 最初からやり直す
    const handleRestart = () => {
        images.forEach(image => URL.revokeObjectURL(image.originalUrl));
        setImages([]);
        setZipBlob(null);
        setZipFilename('');
        setErrors([]);
        setBulkSettings({ industryCode: '', submissionId: '' });
        setScreen('upload');
    };

    // 表示する画面を切り替える
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
