import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, Scissors, ChevronsRight, Download, RotateCcw, Settings, X, HardDriveDownload, AlertCircle, Loader, FileText, Copy, Check, Server, Link2 } from 'lucide-react';

// === CDN & 定数定義 ===

const HEIC_CDN_URL = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
const JSZIP_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const FILESAVER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';

const RESIZE_WIDTH = 600;
const RESIZE_HEIGHT = 400;
const MAX_FILES = 50;
const MAX_FILE_SIZE_MB = 10;

// スプレッドシート連携に失敗した場合のフォールバックデータ
const INITIAL_INDUSTRY_CODES = [
    { code: 'hos', name: '病院' },
    { code: 'htl', name: 'ホテル' },
    { code: 'sal', name: 'サロン' },
    { code: 'tra', name: 'しつけ教室' },
    { code: 'caf', name: 'カフェ' },
    { code: 'run', name: 'ドッグラン' },
];

// === ヘルパー関数 ===

// YYYYMMDD形式の日付文字列を生成
const getFormattedDate = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

// サムネイルを生成
const createThumbnail = (imageUrl) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_DIMENSION = 200;
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
    img.src = imageUrl;
  });
};

// === カスタムフック ===

// CDNから外部スクリプトを読み込む
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

// === 共通コンポーネント ===

const Alert = ({ message, type = 'error', onDismiss }) => {
  if (!message) return null;
  const colors = {
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
  };

  return (
    <div className={`border-l-4 p-4 rounded-md shadow-md ${colors[type]}`} role="alert">
      <div className="flex items-center">
        <AlertCircle className="mr-3"/>
        <p className="font-bold">{message}</p>
        {onDismiss && (
          <button onClick={onDismiss} className="ml-auto text-xl font-bold">&times;</button>
        )}
      </div>
    </div>
  );
};

const LoadingScreen = ({ title, progress, total }) => (
  <div className="w-full h-full flex flex-col items-center justify-center text-center bg-gray-50">
      <h1 className="text-2xl font-bold text-gray-700 mb-10">
          業種別リネーム＆加工ツール <span className="text-lg font-normal text-gray-500">(β版)</span>
      </h1>
      <Loader className="w-16 h-16 animate-spin text-blue-500" />
      <h2 className="text-2xl font-semibold mt-4 text-gray-600">{title}</h2>
      {progress !== undefined && total !== undefined && total > 0 && (
        <>
          <p className="mt-2 text-lg">{`${progress} / ${total} 枚`}</p>
          <div className="w-64 bg-gray-200 rounded-full h-2.5 mt-4">
            <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${(progress / total) * 100}%` }}></div>
          </div>
        </>
      )}
  </div>
);

const CopyButton = ({ textToCopy }) => {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
    };

    return (
        <button onClick={handleCopy} className={`ml-2 p-1 rounded-md transition-colors ${copied ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
        </button>
    );
};


// === 画面別コンポーネント ===

// STEP 1: アップロード画面
const UploadScreen = ({ onFilesAccepted, setErrors }) => {
  const onDrop = useCallback((acceptedFiles, fileRejections) => {
    let currentErrors = [];
    if (acceptedFiles.length + fileRejections.length > MAX_FILES) {
      currentErrors.push(`一度にアップロードできるファイルは${MAX_FILES}枚までです。`);
    }
    
    fileRejections.forEach(rejection => {
        rejection.errors.forEach(err => {
            if (err.code === 'file-too-large') {
                currentErrors.push(`ファイルサイズが大きすぎます: ${rejection.file.name} (${MAX_FILE_SIZE_MB}MBまで)`);
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/heic': ['.heic', '.heif'],
    },
    maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  });

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-800">
          業種別リネーム＆加工ツール <span className="text-lg font-normal text-gray-500">(β版)</span>
        </h1>
        <p className="text-gray-600 mt-2 mb-10">複数の画像をまとめてリネーム・リサイズします。</p>
        
        <div {...getRootProps()} className={`w-full h-80 border-4 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors duration-300 cursor-pointer ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}>
          <input {...getInputProps()} />
          <div className="flex flex-col items-center">
            <UploadCloud className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-gray-500 mb-2">ここにファイルまたはフォルダをドラッグ＆ドロップ</p>
            <p className="text-gray-500 mb-4">または</p>
            <div className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors pointer-events-none">
                ファイルを選択
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-4">{`(JPG, PNG, HEIC / ${MAX_FILES}枚まで)`}</p>
      </div>
    </div>
  );
};

// STEP 2.1: 業種管理モーダル
const IndustryManagementModal = ({ isOpen, onClose, config, setConfig, fetchIndustryCodes }) => {
    if (!isOpen) return null;

    const [tempConfig, setTempConfig] = useState(config);
    const [testStatus, setTestStatus] = useState({ message: '', type: '' });

    const handleSave = () => {
        setConfig(tempConfig);
        fetchIndustryCodes(tempConfig);
        onClose();
    };

    const handleTestConnection = async () => {
        setTestStatus({ message: '接続テスト中...', type: 'loading' });
        const result = await fetchIndustryCodes(tempConfig, true); // `true` to force fetch for test
        if (result.success) {
            setTestStatus({ message: `正常に連携できました (${result.data.length}件)`, type: 'success' });
        } else {
            setTestStatus({ message: `連携に失敗しました: ${result.error}`, type: 'error' });
        }
    };
    
    // モーダルが開かれた時に現在の設定を反映
    useEffect(() => {
        setTempConfig(config);
        setTestStatus({ message: '', type: '' });
    }, [isOpen, config]);

    const serviceAccountEmail = 'service-account-email@developer.gserviceaccount.com';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <header className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800 flex items-center">
                        <Settings className="mr-3 text-gray-500" />
                        業種マスタ連携設定
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </header>

                <div className="p-6 flex-grow overflow-y-auto space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">連携方式</label>
                        <select
                            value={tempConfig.type}
                            onChange={e => setTempConfig({ ...tempConfig, type: e.target.value, value: '' })}
                            className="w-full p-2 border border-gray-300 rounded-lg bg-gray-50"
                        >
                            <option value="api">API方式 (推奨)</option>
                            <option value="url">公開URL方式</option>
                        </select>
                    </div>

                    {tempConfig.type === 'api' ? (
                        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center"><Server size={18} className="mr-2" />API方式の設定</h3>
                            <p className="text-sm text-gray-600">
                                1. A列に業種コード、B列に業種名を入力したGoogleスプレッドシートを用意します。
                            </p>
                            <p className="text-sm text-gray-600">
                                2. 以下のサービスアカウントを、そのシートの「編集者」として共有追加してください。
                            </p>
                            <div className="flex items-center bg-white p-2 border rounded-md">
                                <code className="text-sm text-gray-700 flex-grow">{serviceAccountEmail}</code>
                                <CopyButton textToCopy={serviceAccountEmail} />
                            </div>
                            <p className="text-sm text-gray-600">
                                3. 共有したスプレッドシートのIDを入力してください。<br/>
                                <span className="text-xs text-gray-500">(URLの .../d/【この部分がID】/... に記載されています)</span>
                            </p>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">スプレッドシートID</label>
                                <input 
                                    type="text"
                                    placeholder="例: 1aBcDeFgHiJkLmNoPqRsTuVwXyZ-1234567890abcdefg"
                                    value={tempConfig.value}
                                    onChange={e => setTempConfig({ ...tempConfig, value: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 border rounded-lg bg-gray-50 space-y-4">
                            <h3 className="font-semibold text-gray-800 flex items-center"><Link2 size={18} className="mr-2" />公開URL方式の設定</h3>
                             <p className="text-sm text-gray-600">
                                1. A列に業種コード、B列に業種名を入力したGoogleスプレッドシートを用意します。
                            </p>
                            <p className="text-sm text-gray-600">
                                2. メニューの[ファイル]&gt;[共有]&gt;[ウェブに公開]を選択します。
                            </p>
                             <p className="text-sm text-gray-600">
                                3. 公開形式を「カンマ区切り形式(.csv)」にして公開URLをコピーし、貼り付けてください。
                            </p>
                             <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">スプレッドシートURL (CSV公開用)</label>
                                <input 
                                    type="url"
                                    placeholder="https://docs.google.com/spreadsheets/d/e/.../pub?output=csv"
                                    value={tempConfig.value}
                                    onChange={e => setTempConfig({ ...tempConfig, value: e.target.value })}
                                    className="w-full p-2 border border-gray-300 rounded-lg"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center">
                        <button 
                            onClick={handleTestConnection}
                            disabled={!tempConfig.value || testStatus.type === 'loading'}
                            className="px-4 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors disabled:bg-gray-400"
                        >
                            {testStatus.type === 'loading' ? 'テスト中...' : '接続テスト'}
                        </button>
                        {testStatus.message && (
                            <p className={`ml-4 text-sm ${testStatus.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                                {testStatus.message}
                            </p>
                        )}
                    </div>
                </div>

                <footer className="flex justify-end p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                    <button onClick={onClose} className="px-6 py-2 mr-4 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors">キャンセル</button>
                    <button onClick={handleSave} className="px-6 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors">保存して閉じる</button>
                </footer>
            </div>
        </div>
    );
};

// STEP 2: 一括設定画面
const SettingsScreen = ({ onNext, onBack, bulkSettings, setBulkSettings, industryOptions, openIndustryModal }) => {
    const { industryCode, submissionId } = bulkSettings;
    const isNextDisabled = !industryCode || !submissionId || !/^[0-9]+$/.test(submissionId);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gray-50">
            <div className="w-full max-w-lg">
                <header className="text-center mb-10">
                    <h1 className="text-2xl font-bold text-gray-800">
                      STEP 2/4: 基本情報の一括設定
                    </h1>
                    <p className="text-gray-600 mt-2">リネーム後のファイル名に使われる基本情報を設定してください。</p>
                </header>

                <div className="bg-white p-8 rounded-2xl shadow-md space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">業種</label>
                        <div className="flex items-center">
                            <select 
                                value={industryCode}
                                onChange={e => setBulkSettings({ ...bulkSettings, industryCode: e.target.value })}
                                className="w-full p-3 border border-gray-300 rounded-lg"
                            >
                                <option value="">選択してください</option>
                                {industryOptions.map(opt => (
                                    <option key={opt.code} value={opt.code}>{`${opt.name} (${opt.code})`}</option>
                                ))}
                            </select>
                            <button onClick={openIndustryModal} className="ml-3 p-3 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors flex-shrink-0">
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="submissionId" className="block text-sm font-medium text-gray-700 mb-2">入稿ID</label>
                        <input
                            id="submissionId"
                            type="text"
                            value={submissionId}
                            onChange={e => setBulkSettings({ ...bulkSettings, submissionId: e.target.value })}
                            className="w-full p-3 border border-gray-300 rounded-lg"
                            placeholder="例: 12345"
                        />
                        <p className="text-xs text-gray-500 mt-1">※半角数字で入力してください</p>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">日付</label>
                        <p className="w-full p-3 border border-gray-200 rounded-lg bg-gray-100 text-gray-600">
                            {getFormattedDate()} (自動設定)
                        </p>
                    </div>
                </div>

                <footer className="mt-10 flex justify-between items-center">
                    <button onClick={onBack} className="flex items-center px-6 py-3 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors">
                        <RotateCcw size={16} className="mr-2"/>
                        戻る
                    </button>
                    <button onClick={onNext} disabled={isNextDisabled} className="flex items-center px-6 py-3 rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">
                        次へ
                        <ChevronsRight size={18} className="ml-2"/>
                    </button>
                </footer>
            </div>
        </div>
    );
};

// STEP 3: 確認・個別編集画面
const EditScreen = ({ images, setImages, onProcess, onBack, bulkSettings, industryOptions }) => {
    const [selectedImageId, setSelectedImageId] = useState(null);
    const date = getFormattedDate();

    // 最初に画像が読み込まれたとき、最初の画像を選択状態にする
    useEffect(() => {
        if (images.length > 0 && !selectedImageId) {
            setSelectedImageId(images[0].id);
        }
    }, [images, selectedImageId]);

    const handleIndividualChange = (id, field, value) => {
        setImages(prev => prev.map(img => img.id === id ? { ...img, [field]: value } : img));
    };

    const generateFileName = (image, index) => {
        const sequence = String(index + 1).padStart(2, '0');
        const extension = 'jpg'; // 出力はJPGに統一
        return `${image.industryCode}_${image.submissionId}_${date}_${sequence}.${extension}`;
    };

    const selectedImage = images.find(img => img.id === selectedImageId);
    
    return (
        <div className="w-full h-full flex flex-col bg-gray-50">
            <header className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
                 <h2 className="text-xl font-semibold text-gray-800">
                    STEP 3/4: 確認・個別編集
                 </h2>
            </header>
            
            <main className="flex-grow flex min-h-0">
                {/* 左側: 画像一覧エリア */}
                <div className="w-2/3 border-r border-gray-200 overflow-y-auto p-4 space-y-3">
                    {images.map((image, index) => (
                        <div 
                            key={image.id}
                            onClick={() => setSelectedImageId(image.id)}
                            className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer flex p-3 space-x-4 ${selectedImageId === image.id ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200 hover:shadow-md hover:border-gray-300'}`}
                        >
                            <div className="w-24 h-24 bg-gray-100 rounded-md flex-shrink-0 flex items-center justify-center overflow-hidden">
                                <img src={image.thumbnailUrl} alt={image.file.name} className="object-contain w-full h-full" />
                            </div>
                            <div className="flex-grow flex flex-col justify-center min-w-0">
                                <p className="text-xs text-gray-500 truncate" title={image.file.name}>{image.file.name}</p>
                                <p className="font-semibold text-sm text-gray-800 truncate mt-1" title={generateFileName(image, index)}>
                                    → {generateFileName(image, index)}
                                </p>
                                <div className="text-xs text-gray-500 mt-2">
                                    出力サイズ: <span className="font-medium text-gray-700">{`${RESIZE_WIDTH} x ${RESIZE_HEIGHT} px`}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* 右側: 操作パネル */}
                <div className="w-1/3 flex flex-col">
                    <div className="flex-grow p-6 space-y-8 overflow-y-auto">
                        {/* 一括設定の確認 */}
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">一括設定の確認</h3>
                            <p className="text-sm"><span className="font-semibold text-gray-600">業種:</span> {industryOptions.find(i => i.code === bulkSettings.industryCode)?.name || 'N/A'}</p>
                            <p className="text-sm"><span className="font-semibold text-gray-600">入稿ID:</span> {bulkSettings.submissionId}</p>
                        </div>

                        {/* 選択中画像の個別編集 */}
                        {selectedImage ? (
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">選択中画像の個別編集</h3>
                                <p className="text-sm text-gray-800 bg-gray-100 p-2 rounded-md truncate" title={selectedImage.file.name}>
                                    <FileText size={14} className="inline mr-2" />
                                    {selectedImage.file.name}
                                </p>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">業種:</label>
                                    <select 
                                        value={selectedImage.industryCode} 
                                        onChange={(e) => handleIndividualChange(selectedImage.id, 'industryCode', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    >
                                        {industryOptions.map(opt => (
                                            <option key={opt.code} value={opt.code}>{`${opt.name} (${opt.code})`}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-1">入稿ID:</label>
                                    <input
                                        type="text"
                                        value={selectedImage.submissionId}
                                        onChange={(e) => handleIndividualChange(selectedImage.id, 'submissionId', e.target.value)}
                                        className="w-full p-2 border border-gray-300 rounded-lg"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 mt-10">
                                左の一覧から画像を選択して個別に編集します。
                            </div>
                        )}
                    </div>
                    
                    <footer className="p-4 border-t border-gray-200 bg-white flex justify-between items-center flex-shrink-0">
                        <button onClick={onBack} className="flex items-center px-6 py-2 rounded-lg text-gray-700 bg-gray-200 hover:bg-gray-300 transition-colors">
                            <RotateCcw size={16} className="mr-2"/>
                            戻る
                        </button>
                        <button onClick={() => onProcess(images)} className="flex items-center px-6 py-2 rounded-lg text-white bg-blue-500 hover:bg-blue-600 transition-colors font-semibold">
                            加工してダウンロード
                            <Download size={18} className="ml-2"/>
                        </button>
                    </footer>
                </div>
            </main>
        </div>
    );
};


// STEP 4: ダウンロード画面
const DownloadScreen = ({ zipBlob, zipFileName, onRestart }) => {
    const handleDownload = () => {
      if (window.saveAs && zipBlob) {
        window.saveAs(zipBlob, zipFileName);
      }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center text-center">
            <header className="absolute top-0 left-0 w-full p-4 text-center">
                <h2 className="text-xl font-semibold text-gray-800">
                    STEP 4/4: 完了
                </h2>
            </header>
            <main className="flex-grow w-full flex flex-col items-center justify-center text-center">
                <HardDriveDownload className="w-24 h-24 text-green-500 mb-6" />
                <h2 className="text-3xl font-bold text-gray-800">画像の加工が完了しました！</h2>
                <p className="text-gray-600 mt-2">下のボタンからZIPファイルをダウンロードしてください。</p>
                <button 
                    onClick={handleDownload}
                    className="mt-10 flex items-center px-12 py-4 rounded-xl text-white bg-green-500 hover:bg-green-600 transition-colors font-bold text-lg shadow-lg hover:shadow-xl"
                >
                    <Download size={24} className="mr-3" />
                    {zipFileName} をダウンロード
                </button>
                <button 
                    onClick={onRestart}
                    className="mt-8 flex items-center text-gray-600 hover:text-blue-500 transition-colors"
                >
                    <RotateCcw size={16} className="mr-2"/>
                    最初に戻る
                </button>
            </main>
        </div>
    );
};

// === メイン App コンポーネント ===

export default function App() {
  // 画面フローの状態管理
  const [screen, setScreen] = useState('initializing'); // 'initializing', 'upload', 'loading', 'settings', 'edit', 'processing', 'download'
  
  // データ状態管理
  const [images, setImages] = useState([]);
  const [bulkSettings, setBulkSettings] = useState({ industryCode: '', submissionId: '' });
  const [industryOptions, setIndustryOptions] = useState(INITIAL_INDUSTRY_CODES);
  const [zipBlob, setZipBlob] = useState(null);
  const [zipFileName, setZipFileName] = useState('');

  // UI状態管理
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [errors, setErrors] = useState([]);
  const [isIndustryModalOpen, setIsIndustryModalOpen] = useState(false);
  const [sheetConfig, setSheetConfig] = useState(() => {
      try {
          const saved = localStorage.getItem('sheetConfig');
          return saved ? JSON.parse(saved) : { type: 'api', value: '' };
      } catch (e) {
          return { type: 'api', value: '' };
      }
  });

  // 外部ライブラリの読み込み
  const { isLoaded: isHeicLoaded, error: heicError } = useScript(HEIC_CDN_URL);
  const { isLoaded: isJszipLoaded, error: jszipError } = useScript(JSZIP_CDN);
  const { isLoaded: isFilesaverLoaded, error: filesaverError } = useScript(FILESAVER_CDN);

  // ライブラリ読み込み完了とエラーハンドリング
  useEffect(() => {
    const scriptErrors = [
        heicError && 'HEIC変換ライブラリの読み込みに失敗しました。',
        jszipError && 'ZIP圧縮ライブラリの読み込みに失敗しました。',
        filesaverError && 'ファイル保存ライブラリの読み込みに失敗しました。'
    ].filter(Boolean);

    if (scriptErrors.length > 0) {
        handleErrors(scriptErrors);
    }

    const allLoaded = isHeicLoaded && isJszipLoaded && isFilesaverLoaded;
    if (screen === 'initializing' && allLoaded) {
      fetchIndustryCodes(); // 初期データを取得
      setScreen('upload');
    }
  }, [isHeicLoaded, isJszipLoaded, isFilesaverLoaded, heicError, jszipError, filesaverError, screen]);

  // スプレッドシート設定の永続化
  useEffect(() => {
      localStorage.setItem('sheetConfig', JSON.stringify(sheetConfig));
  }, [sheetConfig]);

  const handleErrors = (newErrors) => {
    setErrors(newErrors);
    setTimeout(() => setErrors([]), 8000);
  };

  // 業種コード取得（バックエンドAPIのモック）
  const fetchIndustryCodes = async (config = sheetConfig, isTest = false) => {
      if (!config.value) {
          if (isTest) return { success: false, error: 'IDまたはURLが入力されていません。' };
          setIndustryOptions(INITIAL_INDUSTRY_CODES);
          return;
      }

      // --- ここからバックエンド連携のモック ---
      console.log(`Fetching with config:`, config);
      await new Promise(resolve => setTimeout(resolve, 1000)); // ネットワーク遅延をシミュレート
      
      // 成功時のダミーデータ
      const dummyData = [
          { code: 'ext-hos', name: '外部連携病院' },
          { code: 'ext-sal', name: '外部連携サロン' },
          { code: 'ext-gym', name: '外部連携ジム' },
      ];
      
      const shouldFail = config.value.includes('fail'); // 'fail'という文字が含まれていたら失敗させる
      if (shouldFail) {
          const errorMsg = 'スプレッドシートが見つからないか、共有設定が正しくありません。';
          if (!isTest) handleErrors([errorMsg]);
          return { success: false, error: errorMsg };
      }
      
      if (!isTest) {
          setIndustryOptions(dummyData);
      }
      return { success: true, data: dummyData };
      // --- ここまでバックエンド連携のモック ---
  };

  // ファイルアップロード処理
  const handleFilesAccepted = async (files) => {
    if (files.length === 0) return;
    setScreen('loading');
    setErrors([]);
    setTotalFiles(files.length);
    setLoadingProgress(0);

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
        });
      } catch(err) {
        console.error("Error processing file:", file.name, err);
        handleErrors([`ファイル処理中にエラーが発生しました: ${file.name}`]);
      }
      setLoadingProgress(prev => prev + 1);
    }

    setImages(newImages);
    setScreen('settings');
  };

  // 一括設定から確認画面へ
  const handleSettingsNext = () => {
      setImages(prevImages => prevImages.map(img => ({
          ...img,
          industryCode: bulkSettings.industryCode,
          submissionId: bulkSettings.submissionId,
      })));
      setScreen('edit');
  };

  // 画像のリサイズとパディング処理
  const resizeAndPadCanvas = (imageUrl) => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.src = imageUrl;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = RESIZE_WIDTH;
            canvas.height = RESIZE_HEIGHT;
            const ctx = canvas.getContext('2d');
            
            // 白背景で塗りつぶし
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, RESIZE_WIDTH, RESIZE_HEIGHT);

            const imgAspect = image.width / image.height;
            const canvasAspect = RESIZE_WIDTH / RESIZE_HEIGHT;
            
            let drawWidth, drawHeight, x, y;

            if (imgAspect > canvasAspect) {
                drawWidth = RESIZE_WIDTH;
                drawHeight = drawWidth / imgAspect;
                x = 0;
                y = (RESIZE_HEIGHT - drawHeight) / 2;
            } else {
                drawHeight = RESIZE_HEIGHT;
                drawWidth = drawHeight * imgAspect;
                y = 0;
                x = (RESIZE_WIDTH - drawWidth) / 2;
            }
            
            ctx.drawImage(image, x, y, drawWidth, drawHeight);
            resolve(canvas);
        };
        image.onerror = reject;
    });
  };

  // 加工とZIP生成処理
  const handleProcess = async (imagesToProcess) => {
    if (!window.JSZip) {
        handleErrors(['ZIP圧縮ライブラリが読み込まれていません。']);
        return;
    }
    setScreen('processing');
    setProcessingProgress(0);
    setTotalFiles(imagesToProcess.length);
    const zip = new window.JSZip();
    const date = getFormattedDate();

    for (const [index, image] of imagesToProcess.entries()) {
      try {
        const canvas = await resizeAndPadCanvas(image.originalUrl);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
        
        const sequence = String(index + 1).padStart(2, '0');
        const fileName = `${image.industryCode}_${image.submissionId}_${date}_${sequence}.jpg`;
        const folderPath = `${image.industryCode}/${image.submissionId}`;
        
        zip.folder(folderPath).file(fileName, blob);

      } catch (err) {
        console.error("Error processing image:", image.file.name, err);
        handleErrors([`画像処理エラー: ${image.file.name}`]);
      }
      setProcessingProgress(prev => prev + 1);
    }

    // ZIPファイル名を決定（最も使われている業種コードと入稿IDを使用）
    const mostCommonIndustry = bulkSettings.industryCode;
    const mostCommonId = bulkSettings.submissionId;
    const finalZipName = `${mostCommonIndustry}_${mostCommonId}.zip`;
    
    setZipFileName(finalZipName);
    const zipFile = await zip.generateAsync({ type: 'blob' });
    setZipBlob(zipFile);
    setScreen('download');
  };
  
  // 最初に戻る処理
  const handleRestart = () => {
    images.forEach(image => {
      if (image.originalUrl) URL.revokeObjectURL(image.originalUrl);
    });
    setImages([]);
    setZipBlob(null);
    setZipFileName('');
    setBulkSettings({ industryCode: '', submissionId: '' });
    setScreen('upload');
    setErrors([]);
  };

  // 画面描画ロジック
  const renderScreen = () => {
    switch (screen) {
      case 'initializing':
        return <LoadingScreen title="ライブラリを準備中..." />;
      case 'loading':
        return <LoadingScreen title="画像を読み込んでいます..." progress={loadingProgress} total={totalFiles} />;
      case 'settings':
        return <SettingsScreen 
                  onNext={handleSettingsNext}
                  onBack={handleRestart}
                  bulkSettings={bulkSettings}
                  setBulkSettings={setBulkSettings}
                  industryOptions={industryOptions}
                  openIndustryModal={() => setIsIndustryModalOpen(true)}
               />;
      case 'edit':
        return <EditScreen 
                  images={images} 
                  setImages={setImages} 
                  onProcess={handleProcess} 
                  onBack={() => setScreen('settings')}
                  bulkSettings={bulkSettings}
                  industryOptions={industryOptions}
               />;
      case 'processing':
        return <LoadingScreen title="画像を処理中です..." progress={processingProgress} total={totalFiles} />;
      case 'download':
        return <DownloadScreen zipBlob={zipBlob} zipFileName={zipFileName} onRestart={handleRestart} />;
      case 'upload':
      default:
        return <UploadScreen onFilesAccepted={handleFilesAccepted} setErrors={handleErrors} />;
    }
  };

 
  return (
      <div className="font-sans w-full h-screen flex flex-col antialiased bg-gray-50 text-gray-800">
          <div className="flex-grow relative min-h-0 flex flex-col">
            <div className="absolute top-4 left-4 right-4 z-50 space-y-2">
              {errors.map((error, index) => (
                  <Alert key={index} message={error} onDismiss={() => setErrors(prev => prev.filter((_, i) => i !== index))} />
              ))}
            </div>
            {renderScreen()}
            <IndustryManagementModal 
                isOpen={isIndustryModalOpen}
                onClose={() => setIsIndustryModalOpen(false)}
                config={sheetConfig}
                setConfig={setSheetConfig}
                fetchIndustryCodes={fetchIndustryCodes}
            />
          </div>
      </div>
  );
}
