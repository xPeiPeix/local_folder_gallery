// 文件扫描器模块
class FileScanner {
    constructor() {
        this.supportedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        this.imageFiles = [];
        this.onProgressCallback = null;
        this.onCompleteCallback = null;
        this.onIncrementalCallback = null; // 增量加载回调
        this.batchSize = 5; // 每批处理的图片数量
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

    // 创建缩略图 - 优化画质版本
    createThumbnail(file, maxWidth = 400, maxHeight = 300) {
        return new Promise((resolve) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const url = URL.createObjectURL(file);

            img.onload = () => {
                // 计算缩略图尺寸，保持高分辨率
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

                // 使用设备像素比提高清晰度
                const dpr = window.devicePixelRatio || 1;
                canvas.width = width * dpr;
                canvas.height = height * dpr;
                canvas.style.width = width + 'px';
                canvas.style.height = height + 'px';
                
                // 设置高质量绘制
                ctx.scale(dpr, dpr);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // 绘制缩略图
                ctx.drawImage(img, 0, 0, width, height);
                
                URL.revokeObjectURL(url);
                // 使用PNG格式避免JPEG压缩损失，或使用更高质量的JPEG
                resolve(canvas.toDataURL('image/png'));
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };

            img.src = url;
        });
    }

    // 处理文件夹 - 增量加载版本
    async scanFolder(files) {
        this.imageFiles = [];
        const totalFiles = files.length;
        let processedFiles = 0;
        let batchCount = 0;
        const currentBatch = [];

        // 调用进度回调
        if (this.onProgressCallback) {
            this.onProgressCallback(0, totalFiles);
        }

        // 过滤出图片文件
        const imageFiles = Array.from(files).filter(file => this.isImageFile(file));
        
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
                    this.onProgressCallback(processedFiles, imageFiles.length);
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

    // 清理资源
    cleanup() {
        this.imageFiles.forEach(img => {
            if (img.url) {
                URL.revokeObjectURL(img.url);
            }
        });
        this.imageFiles = [];
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