// 文件扫描器模块
class FileScanner {
    constructor() {
        this.supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        this.imageFiles = [];
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onIncrementalCallback = null; // 增量加载回调
        this.batchSize = 5; // 每批处理的图片数量
        
        // 性能优化配置
        this.maxThumbnailCache = 200; // 最大缓存缩略图数量
        this.thumbnailCache = new Map(); // LRU缓存
        this.memoryUsageLimit = 100 * 1024 * 1024; // 100MB内存限制
    }

    // 设置进度回调
    setProgressCallback(callback) {
        this.onProgressCallback = callback;
    }

    // 设置完成回调
    setCompleteCallback(callback) {
        this.onCompleteCallback = callback;
    }

    // 设置增量加载回调
    setIncrementalCallback(callback) {
        this.onIncrementalCallback = callback;
    }

    // 检查文件是否为支持的图片格式
    isImageFile(file) {
        return this.supportedTypes.includes(file.type.toLowerCase()) ||
               this.isImageByExtension(file.name);
    }

    // 通过文件扩展名检查是否为图片
    isImageByExtension(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
    }

    // 格式化文件大小
    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 获取图片尺寸
    getImageDimensions(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve({
                    width: img.naturalWidth,
                    height: img.naturalHeight
                });
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve({ width: 0, height: 0 });
            };
            
            img.src = url;
        });
    }

    // 创建缩略图 - 内存优化版本
    createThumbnail(file, maxWidth = 320, maxHeight = 240) {
        const cacheKey = `${file.name}_${file.size}_${file.lastModified}`;
        
        // 检查缓存
        if (this.thumbnailCache.has(cacheKey)) {
            const cached = this.thumbnailCache.get(cacheKey);
            // LRU: 移到最后
            this.thumbnailCache.delete(cacheKey);
            this.thumbnailCache.set(cacheKey, cached);
            return Promise.resolve(cached);
        }

        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const url = URL.createObjectURL(file);

            img.onload = () => {
                try {
                    // 计算缩略图尺寸 - 适中分辨率平衡画质和内存
                    let { width, height } = img;
                    
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }

                    // 保持合理的画质，不使用过高的DPR
                    const dpr = Math.min(window.devicePixelRatio || 1, 2);
                    canvas.width = width * dpr;
                    canvas.height = height * dpr;
                    canvas.style.width = width + 'px';
                    canvas.style.height = height + 'px';
                    
                    // 高质量绘制
                    ctx.scale(dpr, dpr);
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // 绘制缩略图
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // 使用JPEG格式减少内存占用，质量90%
                    const thumbnail = canvas.toDataURL('image/jpeg', 0.9);
                    
                    // 缓存管理
                    this.manageThumbnailCache(cacheKey, thumbnail);
                    
                    resolve(thumbnail);
                } catch (error) {
                    console.warn('缩略图生成失败:', error);
                    resolve(null);
                } finally {
                    URL.revokeObjectURL(url);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.src = url;
        });
    }

    // 管理缩略图缓存 - LRU机制
    manageThumbnailCache(key, thumbnail) {
        // 清理超出限制的缓存
        while (this.thumbnailCache.size >= this.maxThumbnailCache) {
            const firstKey = this.thumbnailCache.keys().next().value;
            this.thumbnailCache.delete(firstKey);
        }
        
        this.thumbnailCache.set(key, thumbnail);
    }

    // 处理文件夹 - 增量加载版本
    async scanFolder(files) {
        this.imageFiles = [];
        const totalFiles = files.length;
        this.totalFilesScanned = totalFiles; // 保存总文件数
        let processedFiles = 0;
        let batchCount = 0;
        const currentBatch = [];

        // 过滤出图片文件
        const imageFiles = Array.from(files).filter(file => this.isImageFile(file));
        const imageFileCount = imageFiles.length;
        const imagePercentage = totalFiles > 0 ? Math.round((imageFileCount / totalFiles) * 100) : 0;
        this.fileStatistics = { // 保存统计信息
            totalFiles: totalFiles,
            imageFiles: imageFileCount,
            percentage: imagePercentage,
            nonImageFiles: totalFiles - imageFileCount
        };

        // 调用进度回调，包含统计信息
        if (this.onProgressCallback) {
            this.onProgressCallback(0, totalFiles, {
                totalFiles: totalFiles,
                imageFiles: imageFileCount,
                percentage: imagePercentage,
                nonImageFiles: totalFiles - imageFileCount
            });
        }
        
        for (let i = 0; i < imageFiles.length; i++) {
            const file = imageFiles[i];
            
            try {
                // 获取图片尺寸
                const dimensions = await this.getImageDimensions(file);
                
                // 创建缩略图
                const thumbnail = await this.createThumbnail(file);
                
                // 创建图片对象
                const imageInfo = {
                    id: `img_${Date.now()}_${i}`,
                    file: file,
                    name: file.name,
                    size: file.size,
                    sizeFormatted: this.formatFileSize(file.size),
                    type: file.type || this.getTypeByExtension(file.name),
                    lastModified: file.lastModified,
                    path: file.webkitRelativePath || file.name,
                    dimensions: dimensions,
                    thumbnail: thumbnail,
                    selected: false,
                    url: URL.createObjectURL(file)
                };

                this.imageFiles.push(imageInfo);
                currentBatch.push(imageInfo);
                processedFiles++;
                
                // 更新进度
                if (this.onProgressCallback) {
                    this.onProgressCallback(processedFiles, imageFiles.length, {
                        totalFiles: totalFiles,
                        imageFiles: imageFileCount,
                        percentage: imagePercentage,
                        nonImageFiles: totalFiles - imageFileCount
                    });
                }

                // 增量回调 - 每处理完一批就通知UI更新
                if (currentBatch.length >= this.batchSize || i === imageFiles.length - 1) {
                    if (this.onIncrementalCallback && currentBatch.length > 0) {
                        this.onIncrementalCallback([...currentBatch], processedFiles, imageFiles.length);
                    }
                    currentBatch.length = 0; // 清空当前批次
                    batchCount++;
                    
                    // 给UI一点时间更新，避免阻塞
                    await new Promise(resolve => setTimeout(resolve, 10));
                }
                
            } catch (error) {
                console.warn('处理图片失败:', file.name, error);
                processedFiles++;
            }
        }

        // 扫描完成
        if (this.onCompleteCallback) {
            this.onCompleteCallback(this.imageFiles);
        }

        return this.imageFiles;
    }

    // 通过扩展名获取MIME类型
    getTypeByExtension(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const typeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
        };
        return typeMap[ext] || 'image/unknown';
    }

    // 获取扫描结果
    getImageFiles() {
        return this.imageFiles;
    }

    // 清理资源 - 增强版
    cleanup() {
        // 清理所有URL对象
        this.imageFiles.forEach(img => {
            if (img.url) {
                URL.revokeObjectURL(img.url);
            }
        });
        
        // 清理缓存
        this.thumbnailCache.clear();
        
        // 重置数据
        this.imageFiles = [];
        this.totalFilesScanned = 0;
        this.fileStatistics = null;
        
        // 强制垃圾回收提示 (仅在开发环境或特定浏览器)
        if (window.gc) {
            window.gc();
        }
    }

    // 获取内存使用估算
    getMemoryUsageEstimate() {
        const thumbnailCount = this.thumbnailCache.size;
        const avgThumbnailSize = 120 * 1024; // 估算每个JPEG缩略图120KB (320x240, 90%质量)
        const thumbnailMemory = thumbnailCount * avgThumbnailSize;
        const objectMemory = this.imageFiles.length * 2048; // 每个对象约2KB
        
        return {
            thumbnailMemory: thumbnailMemory,
            objectMemory: objectMemory,
            totalMemory: thumbnailMemory + objectMemory,
            thumbnailCount: thumbnailCount,
            imageCount: this.imageFiles.length,
            formatted: {
                thumbnail: this.formatFileSize(thumbnailMemory),
                object: this.formatFileSize(objectMemory),
                total: this.formatFileSize(thumbnailMemory + objectMemory)
            }
        };
    }

    // 排序图片
    sortImages(sortBy = 'name', order = 'asc') {
        this.imageFiles.sort((a, b) => {
            let valueA, valueB;
            
            switch (sortBy) {
                case 'name':
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
                    break;
                case 'size':
                    valueA = a.size;
                    valueB = b.size;
                    break;
                case 'date':
                    valueA = a.lastModified;
                    valueB = b.lastModified;
                    break;
                case 'type':
                    valueA = a.type;
                    valueB = b.type;
                    break;
                default:
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
            }

            if (valueA < valueB) return order === 'asc' ? -1 : 1;
            if (valueA > valueB) return order === 'asc' ? 1 : -1;
            return 0;
        });

        return this.imageFiles;
    }

    // 筛选图片
    filterImages(searchTerm = '', typeFilter = 'all') {
        return this.imageFiles.filter(img => {
            // 名称筛选
            const nameMatch = searchTerm === '' || 
                             img.name.toLowerCase().includes(searchTerm.toLowerCase());
            
            // 类型筛选
            let typeMatch = true;
            if (typeFilter !== 'all') {
                const imgType = img.type.split('/')[1] || '';
                typeMatch = imgType.toLowerCase().includes(typeFilter.toLowerCase());
            }

            return nameMatch && typeMatch;
        });
    }
} 