// 导出管理器模块
class ExportManager {
    constructor() {
        this.selectedImages = new Set();
        this.isExporting = false;
        this.onSelectionChangeCallback = null;
        
        this.initEventListeners();
    }

    // 初始化事件监听
    initEventListeners() {
        // 监听图片选择状态改变
        document.addEventListener('imageSelectionChanged', (e) => {
            const image = e.detail.image;
            this.updateSelection(image);
        });
    }

    // 设置选择状态改变回调
    setSelectionChangeCallback(callback) {
        this.onSelectionChangeCallback = callback;
    }

    // 更新选择状态
    updateSelection(image) {
        if (image.selected) {
            this.selectedImages.add(image.id);
        } else {
            this.selectedImages.delete(image.id);
        }

        // 触发回调
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.selectedImages.size);
        }
    }

    // 选择所有图片
    selectAll(images) {
        images.forEach(image => {
            image.selected = true;
            this.selectedImages.add(image.id);
        });

        this.updateUISelection(images);
        
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.selectedImages.size);
        }
    }

    // 取消选择所有图片
    deselectAll(images) {
        images.forEach(image => {
            image.selected = false;
            this.selectedImages.delete(image.id);
        });

        this.updateUISelection(images);
        
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(this.selectedImages.size);
        }
    }

    // 更新UI选择状态
    updateUISelection(images) {
        images.forEach(image => {
            const checkbox = document.querySelector(`#checkbox_${image.id}`);
            const imageItem = document.querySelector(`#item_${image.id}`);
            
            if (checkbox) {
                checkbox.checked = image.selected;
            }
            
            if (imageItem) {
                if (image.selected) {
                    imageItem.classList.add('selected');
                } else {
                    imageItem.classList.remove('selected');
                }
            }
        });
    }

    // 切换单个图片选择状态
    toggleImageSelection(imageId, images) {
        const image = images.find(img => img.id === imageId);
        if (!image) return;

        image.selected = !image.selected;
        this.updateSelection(image);
        this.updateUISelection([image]);
    }

    // 获取选中的图片
    getSelectedImages(images) {
        return images.filter(image => this.selectedImages.has(image.id));
    }

    // 导出选中的图片为ZIP
    async exportSelectedImages(images) {
        const selectedImages = this.getSelectedImages(images);
        
        if (selectedImages.length === 0) {
            this.showMessage('请先选择要导出的图片', 'warning');
            return;
        }

        if (this.isExporting) {
            this.showMessage('正在导出中，请稍候...', 'info');
            return;
        }

        this.isExporting = true;
        
        try {
            await this.createAndDownloadZip(selectedImages);
            this.showMessage(`成功导出 ${selectedImages.length} 张图片`, 'success');
        } catch (error) {
            console.error('导出失败:', error);
            this.showMessage('导出失败: ' + error.message, 'error');
        } finally {
            this.isExporting = false;
        }
    }

    // 创建并下载ZIP文件
    async createAndDownloadZip(selectedImages) {
        // 检查JSZip是否可用
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip库未加载');
        }

        const zip = new JSZip();
        const progressCallback = this.createProgressCallback(selectedImages.length);
        
        // 显示进度
        this.showProgressBar(true);

        try {
            // 添加文件到ZIP
            for (let i = 0; i < selectedImages.length; i++) {
                const image = selectedImages[i];
                
                try {
                    // 读取文件内容
                    const fileContent = await this.readFileAsArrayBuffer(image.file);
                    
                    // 生成安全的文件名
                    const fileName = this.generateSafeFileName(image.name, i);
                    
                    // 添加到ZIP
                    zip.file(fileName, fileContent);
                    
                    // 更新进度
                    progressCallback(i + 1);
                    
                } catch (error) {
                    console.warn(`跳过文件 ${image.name}:`, error);
                }
            }

            // 生成ZIP文件
            this.updateProgressMessage('正在生成ZIP文件...');
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: {
                    level: 6
                }
            });

            // 下载文件
            this.downloadBlob(zipBlob, this.generateZipFileName());
            
        } finally {
            this.showProgressBar(false);
        }
    }

    // 读取文件为ArrayBuffer
    readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('文件读取失败'));
            
            reader.readAsArrayBuffer(file);
        });
    }

    // 生成安全的文件名
    generateSafeFileName(originalName, index) {
        // 替换不安全字符
        let safeName = originalName.replace(/[<>:"/\\|?*]/g, '_');
        
        // 确保文件名唯一
        const ext = safeName.split('.').pop();
        const nameWithoutExt = safeName.substring(0, safeName.lastIndexOf('.'));
        
        return `${String(index + 1).padStart(3, '0')}_${nameWithoutExt}.${ext}`;
    }

    // 生成ZIP文件名
    generateZipFileName() {
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[:-]/g, '');
        return `exported_images_${timestamp}.zip`;
    }

    // 下载Blob文件
    downloadBlob(blob, fileName) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // 清理URL
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // 创建进度回调
    createProgressCallback(total) {
        return (current) => {
            const percentage = Math.round((current / total) * 100);
            this.updateProgress(percentage, current, total);
        };
    }

    // 显示/隐藏进度条
    showProgressBar(show) {
        let progressBar = document.getElementById('exportProgress');
        
        if (show && !progressBar) {
            progressBar = this.createProgressBar();
            document.body.appendChild(progressBar);
        }
        
        if (progressBar) {
            progressBar.style.display = show ? 'flex' : 'none';
            if (!show && progressBar.parentNode) {
                progressBar.parentNode.removeChild(progressBar);
            }
        }
    }

    // 创建进度条
    createProgressBar() {
        const progressBar = document.createElement('div');
        progressBar.id = 'exportProgress';
        progressBar.innerHTML = `
            <div class="progress-backdrop">
                <div class="progress-modal">
                    <div class="progress-title">正在导出图片...</div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="progressBarFill"></div>
                    </div>
                    <div class="progress-text" id="progressText">0%</div>
                </div>
            </div>
        `;
        
        // 添加样式
        progressBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 2000;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        // 添加内部样式
        const style = document.createElement('style');
        style.textContent = `
            .progress-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .progress-modal {
                background: white;
                padding: 30px;
                border-radius: 12px;
                min-width: 300px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            }
            .progress-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 20px;
                color: #333;
            }
            .progress-bar-container {
                width: 100%;
                height: 10px;
                background: #e9ecef;
                border-radius: 5px;
                overflow: hidden;
                margin-bottom: 15px;
            }
            .progress-bar {
                height: 100%;
                background: linear-gradient(45deg, #667eea, #764ba2);
                width: 0%;
                transition: width 0.3s ease;
            }
            .progress-text {
                font-size: 14px;
                color: #666;
            }
        `;
        
        if (!document.getElementById('progressStyles')) {
            style.id = 'progressStyles';
            document.head.appendChild(style);
        }
        
        return progressBar;
    }

    // 更新进度
    updateProgress(percentage, current, total) {
        const progressBarFill = document.getElementById('progressBarFill');
        const progressText = document.getElementById('progressText');
        
        if (progressBarFill) {
            progressBarFill.style.width = percentage + '%';
        }
        
        if (progressText) {
            progressText.textContent = `${percentage}% (${current}/${total})`;
        }
    }

    // 更新进度消息
    updateProgressMessage(message) {
        const progressTitle = document.querySelector('.progress-title');
        if (progressTitle) {
            progressTitle.textContent = message;
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息框
        const messageBox = document.createElement('div');
        messageBox.className = `message-toast message-${type}`;
        messageBox.textContent = message;
        
        // 样式
        messageBox.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 3000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        
        // 根据类型设置颜色
        const colors = {
            'success': '#28a745',
            'error': '#dc3545',
            'warning': '#ffc107',
            'info': '#17a2b8'
        };
        
        messageBox.style.background = colors[type] || colors.info;
        
        document.body.appendChild(messageBox);
        
        // 显示动画
        setTimeout(() => {
            messageBox.style.transform = 'translateX(0)';
        }, 10);
        
        // 自动隐藏
        setTimeout(() => {
            messageBox.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageBox.parentNode) {
                    messageBox.parentNode.removeChild(messageBox);
                }
            }, 300);
        }, 3000);
    }

    // 获取选中数量
    getSelectedCount() {
        return this.selectedImages.size;
    }

    // 清空选择
    clearSelection() {
        this.selectedImages.clear();
        
        if (this.onSelectionChangeCallback) {
            this.onSelectionChangeCallback(0);
        }
    }
} 