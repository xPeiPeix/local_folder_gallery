// 主应用类
class LocalFolderGallery {
    constructor() {
        // 初始化模块
        this.fileScanner = new FileScanner();
        this.imageViewer = new ImageViewer();
        this.exportManager = new ExportManager();
        
        // 数据状态
        this.allImages = [];
        this.filteredImages = [];
        this.currentSortBy = 'name';
        this.currentSortOrder = 'asc';
        this.currentTypeFilter = 'all';
        this.currentSearchTerm = '';
        this.isIncrementalLoading = false;
        
        // UI元素
        this.initUIElements();
        this.bindEvents();
        this.setupCallbacks();
        
        // 启用图片查看器缩放功能
        this.imageViewer.enableZoom();
        
        // 初始化内存监控
        this.initMemoryMonitor();
    }

    // 初始化UI元素
    initUIElements() {
        this.folderInput = document.getElementById('folderInput');
        this.loadingIndicator = document.getElementById('loadingIndicator');
        this.imageGrid = document.getElementById('imageGrid');
        this.imageCount = document.getElementById('imageCount');
        this.selectedCount = document.getElementById('selectedCount');
        this.fileStats = document.getElementById('fileStats');
        this.selectAllBtn = document.getElementById('selectAllBtn');
        this.deselectAllBtn = document.getElementById('deselectAllBtn');
        this.exportBtn = document.getElementById('exportBtn');
        this.sortSelect = document.getElementById('sortSelect');
        this.typeFilter = document.getElementById('typeFilter');
        this.searchInput = document.getElementById('searchInput');
    }

    // 绑定事件
    bindEvents() {
        // 文件夹选择
        this.folderInput.addEventListener('change', (e) => {
            // 如果图片查看器正在显示，则忽略文件夹选择事件
            if (this.imageViewer && this.imageViewer.isOpen) {
                console.log('🐱 nya~ 图片查看器打开中，忽略文件夹选择事件');
                return;
            }
            this.handleFolderSelection(e.target.files);
        });

        // 批量操作
        this.selectAllBtn.addEventListener('click', () => {
            this.exportManager.selectAll(this.filteredImages);
        });

        this.deselectAllBtn.addEventListener('click', () => {
            this.exportManager.deselectAll(this.filteredImages);
        });

        this.exportBtn.addEventListener('click', () => {
            this.exportManager.exportSelectedImages(this.allImages);
        });

        // 排序和筛选
        this.sortSelect.addEventListener('change', (e) => {
            this.currentSortBy = e.target.value;
            this.applySortAndFilter();
        });

        this.typeFilter.addEventListener('change', (e) => {
            this.currentTypeFilter = e.target.value;
            this.applySortAndFilter();
        });

        // 搜索
        this.searchInput.addEventListener('input', (e) => {
            this.currentSearchTerm = e.target.value.trim();
            this.debounceSearch();
        });

        // 拖拽文件夹支持
        this.setupDragAndDrop();
    }

    // 设置回调函数
    setupCallbacks() {
        // 文件扫描进度回调
        this.fileScanner.setProgressCallback((current, total, stats) => {
            this.updateLoadingProgress(current, total, stats);
        });

        // 文件扫描完成回调
        this.fileScanner.setCompleteCallback((images) => {
            this.handleScanComplete(images);
        });

        // 增量加载回调
        this.fileScanner.setIncrementalCallback((newImages, processed, total) => {
            this.handleIncrementalUpdate(newImages, processed, total);
        });

        // 选择状态改变回调
        this.exportManager.setSelectionChangeCallback((selectedCount) => {
            this.updateSelectedCount(selectedCount);
        });

        // 监听图片查看器中的选择状态改变
        document.addEventListener('imageSelectionChanged', (e) => {
            const changedImage = e.detail.image;
            this.updateImageItemUI(changedImage);
        });
    }

    // 处理文件夹选择
    async handleFolderSelection(files) {
        if (!files || files.length === 0) return;

        // 显示加载指示器
        this.showLoading(true);
        
        // 清空之前的数据
        this.clearPreviousData();

        // 标记开始增量加载
        this.isIncrementalLoading = true;

        try {
            // 扫描文件夹
            await this.fileScanner.scanFolder(files);
        } catch (error) {
            console.error('扫描文件夹失败:', error);
            this.showMessage('扫描文件夹失败: ' + error.message, 'error');
            this.showLoading(false);
            this.isIncrementalLoading = false;
        }
    }

    // 处理增量更新
    handleIncrementalUpdate(newImages, processed, total) {
        // 将新图片添加到全部图片数组
        this.allImages = [...this.allImages, ...newImages];
        
        // 筛选新图片（应用当前的搜索和筛选条件）
        const filteredNewImages = newImages.filter(img => {
            // 名称筛选
            const nameMatch = this.currentSearchTerm === '' || 
                             img.name.toLowerCase().includes(this.currentSearchTerm.toLowerCase());
            
            // 类型筛选
            let typeMatch = true;
            if (this.currentTypeFilter !== 'all') {
                const imgType = img.type.split('/')[1] || '';
                typeMatch = imgType.toLowerCase().includes(this.currentTypeFilter.toLowerCase());
            }

            return nameMatch && typeMatch;
        });

        // 更新筛选数组
        this.filteredImages = [...this.filteredImages, ...filteredNewImages];
        
        // 更新计数
        this.updateImageCount(this.allImages.length);
        this.updateLoadingProgress(processed, total);
        
        // 如果是第一批，更新文件统计信息
        if (this.allImages.length === newImages.length && this.fileScanner.fileStatistics) {
            this.updateFileStats(this.fileScanner.fileStatistics);
        }
        
        // 增量添加符合筛选条件的图片到网格
        if (filteredNewImages.length > 0) {
            this.appendImagesToGrid(filteredNewImages);
        }
        
        // 如果这是第一批图片，给用户一个提示
        if (this.allImages.length === newImages.length && newImages.length > 0) {
            this.showMessage('开始加载图片，可以立即浏览已加载的内容！', 'info');
        }
    }

    // 处理扫描完成
    handleScanComplete(images) {
        // 清除增量加载标记
        this.isIncrementalLoading = false;
        
        // 最终的图片数组已经通过增量更新建立好了
        this.updateImageCount(this.allImages.length);
        
        // 隐藏加载指示器
        this.showLoading(false);
        
        if (this.allImages.length === 0) {
            this.showEmptyState();
        } else {
            // 获取内存使用信息
            const memoryInfo = this.fileScanner.getMemoryUsageEstimate();
            this.showMessage(
                `成功加载 ${this.allImages.length} 张图片 | 内存占用约 ${memoryInfo.formatted.total}`, 
                'success'
            );
            
            // 内存使用警告
            if (memoryInfo.totalMemory > 200 * 1024 * 1024) { // 超过200MB
                this.showMessage(`⚠️ 内存占用较高 (${memoryInfo.formatted.total})，建议分批处理大文件夹`, 'warning');
            }
            
            // 完成后重新应用排序和筛选
            this.applySortAndFilter();
        }
    }

    // 应用排序和筛选
    applySortAndFilter() {
        if (this.allImages.length === 0) return;

        // 如果正在增量加载，则不进行完全重渲染
        // 因为增量更新已经处理了筛选逻辑
        if (this.isIncrementalLoading) {
            return;
        }

        // 筛选图片
        this.filteredImages = this.fileScanner.filterImages(
            this.currentSearchTerm, 
            this.currentTypeFilter
        );

        // 排序图片
        this.sortImages(this.filteredImages);

        // 渲染图片网格
        this.renderImageGrid(this.filteredImages);
        
        // 更新统计信息
        this.updateFilteredCount(this.filteredImages.length);
    }

    // 排序图片
    sortImages(images) {
        images.sort((a, b) => {
            let valueA, valueB;
            
            switch (this.currentSortBy) {
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
                default:
                    valueA = a.name.toLowerCase();
                    valueB = b.name.toLowerCase();
            }

            if (valueA < valueB) return this.currentSortOrder === 'asc' ? -1 : 1;
            if (valueA > valueB) return this.currentSortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }

    // 渲染图片网格
    renderImageGrid(images) {
        this.imageGrid.innerHTML = '';

        if (images.length === 0) {
            this.showNoResultsState();
            return;
        }

        images.forEach((image, index) => {
            const imageItem = this.createImageItem(image, index);
            this.imageGrid.appendChild(imageItem);
        });
    }

    // 增量添加图片到网格
    appendImagesToGrid(newImages) {
        // 清除可能存在的空状态提示
        const emptyState = this.imageGrid.querySelector('.empty-state');
        if (emptyState) {
            emptyState.remove();
        }

        // 计算正确的索引，基于当前筛选数组的长度
        const startIndex = this.filteredImages.length - newImages.length;
        
        newImages.forEach((image, index) => {
            const correctIndex = startIndex + index;
            const imageItem = this.createImageItem(image, correctIndex);
            this.imageGrid.appendChild(imageItem);
            
            // 添加淡入动画效果
            imageItem.style.opacity = '0';
            imageItem.style.transform = 'translateY(20px)';
            
            // 延迟显示动画，创造流畅的加载效果
            setTimeout(() => {
                imageItem.style.transition = 'all 0.3s ease-out';
                imageItem.style.opacity = '1';
                imageItem.style.transform = 'translateY(0)';
            }, index * 50); // 错开动画时间
        });
    }

    // 创建图片项目
    createImageItem(image, index) {
        const item = document.createElement('div');
        item.className = 'image-item';
        item.id = `item_${image.id}`;
        
        if (image.selected) {
            item.classList.add('selected');
        }

        item.innerHTML = `
            <input type="checkbox" 
                   class="image-item-checkbox" 
                   id="checkbox_${image.id}"
                   ${image.selected ? 'checked' : ''}>
            <img src="${image.thumbnail || image.url}" 
                 alt="${image.name}" 
                 loading="lazy"
                 onerror="this.src='${this.createPlaceholderImage()}'">
            <div class="image-item-info">
                <div class="image-item-name" title="${image.name}">${image.name}</div>
                <div class="image-item-details">
                    <span>${image.sizeFormatted}</span>
                    <span>${image.dimensions.width}×${image.dimensions.height}</span>
                </div>
            </div>
        `;

        // 绑定事件
        this.bindImageItemEvents(item, image, index);

        return item;
    }

    // 绑定图片项目事件
    bindImageItemEvents(item, image, index) {
        const img = item.querySelector('img');
        const checkbox = item.querySelector('.image-item-checkbox');

        // 图片点击 - 打开查看器
        img.addEventListener('click', () => {
            this.imageViewer.show(this.filteredImages, index);
        });

        // 复选框变化
        checkbox.addEventListener('change', (e) => {
            this.exportManager.toggleImageSelection(image.id, this.allImages);
        });

        // 整个项目点击选择（除了图片）
        item.addEventListener('click', (e) => {
            if (e.target !== img && e.target !== checkbox) {
                checkbox.checked = !checkbox.checked;
                this.exportManager.toggleImageSelection(image.id, this.allImages);
            }
        });
    }

    // 设置拖拽支持
    setupDragAndDrop() {
        const dropZone = document.body;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-highlight');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-highlight');
            });
        });

        dropZone.addEventListener('drop', (e) => {
            // 如果图片查看器正在显示，则忽略拖拽文件夹事件
            if (this.imageViewer && this.imageViewer.isOpen) {
                console.log('🐱 nya~ 图片查看器打开中，忽略拖拽文件夹事件');
                return;
            }

            const files = Array.from(e.dataTransfer.files);
            
            if (files.length > 0) {
                // 模拟文件夹输入
                this.folderInput.files = e.dataTransfer.files;
                this.handleFolderSelection(e.dataTransfer.files);
            }
        });
    }

    // 防抖搜索
    debounceSearch() {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            this.applySortAndFilter();
        }, 300);
    }

    // 显示/隐藏加载指示器
    showLoading(show) {
        this.loadingIndicator.style.display = show ? 'block' : 'none';
    }

    // 更新加载进度
    updateLoadingProgress(current, total, stats) {
        const progressText = this.loadingIndicator.querySelector('p');
        if (progressText && stats) {
            let message = `正在扫描文件夹... `;
            
            if (current === 0) {
                // 初始统计信息
                message += `发现 ${stats.imageFiles} 张图片 / ${stats.totalFiles} 个文件 (${stats.percentage}%)`;
                if (stats.nonImageFiles > 0) {
                    message += ` | 跳过 ${stats.nonImageFiles} 个非图片文件`;
                }
            } else if (this.allImages.length > 0) {
                // 增量加载中
                message += `已处理 ${this.allImages.length} 张图片 (${current}/${stats.imageFiles}) | 图片占比 ${stats.percentage}%`;
            } else {
                message += `(${current}/${total}) | 图片文件: ${stats.imageFiles} (${stats.percentage}%)`;
            }
            
            progressText.textContent = message;
        } else if (progressText) {
            // 兼容旧版本调用
            progressText.textContent = `正在扫描文件夹... (${current}/${total})`;
        }
    }

    // 更新图片数量
    updateImageCount(count) {
        this.imageCount.textContent = `已加载: ${count} 张图片`;
    }

    // 更新筛选后数量
    updateFilteredCount(count) {
        if (count !== this.allImages.length) {
            this.imageCount.textContent = `已加载: ${this.allImages.length} 张图片 (显示: ${count})`;
        }
    }

    // 更新选中数量
    updateSelectedCount(count) {
        this.selectedCount.textContent = `已选择: ${count} 张`;
        this.exportBtn.disabled = count === 0;
    }

    // 更新文件统计信息
    updateFileStats(stats) {
        if (stats && this.fileStats) {
            this.fileStats.style.display = 'inline';
            this.fileStats.textContent = `图片占比: ${stats.percentage}% (${stats.imageFiles}/${stats.totalFiles})`;
            
            // 如果有非图片文件，添加到标题提示中
            if (stats.nonImageFiles > 0) {
                this.fileStats.title = `图片文件: ${stats.imageFiles} 个\n非图片文件: ${stats.nonImageFiles} 个\n支持格式: JPG, PNG, GIF, WebP`;
            } else {
                this.fileStats.title = `所有文件都是支持的图片格式\n支持格式: JPG, PNG, GIF, WebP`;
            }
        }
    }

    // 更新指定图片项的UI状态
    updateImageItemUI(changedImage) {
        const imageItem = document.getElementById(`item_${changedImage.id}`);
        if (!imageItem) return;

        const checkbox = imageItem.querySelector(`#checkbox_${changedImage.id}`);
        if (checkbox) {
            checkbox.checked = changedImage.selected;
            
            // 更新视觉状态
            if (changedImage.selected) {
                imageItem.classList.add('selected');
            } else {
                imageItem.classList.remove('selected');
            }
            
            console.log(`🐱 nya~ 图片UI状态已同步: ${changedImage.name} - ${changedImage.selected ? '已选择' : '未选择'}`);
        }
    }

    // 清空之前的数据
    clearPreviousData() {
        // 清理文件扫描器
        this.fileScanner.cleanup();
        
        // 清空数组
        this.allImages = [];
        this.filteredImages = [];
        
        // 清空选择
        this.exportManager.clearSelection();
        
        // 清空UI
        this.imageGrid.innerHTML = '';
        this.updateImageCount(0);
        this.updateSelectedCount(0);
        
        // 隐藏文件统计
        if (this.fileStats) {
            this.fileStats.style.display = 'none';
        }
        
        // 重置搜索和筛选状态
        this.searchInput.value = '';
        this.currentSearchTerm = '';
        this.currentTypeFilter = 'all';
        this.typeFilter.value = 'all';
        
        // 重置增量加载状态
        this.isIncrementalLoading = false;
    }

    // 显示空状态
    showEmptyState() {
        this.imageGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📁</div>
                <h3>未找到图片文件</h3>
                <p>所选文件夹中没有找到支持的图片格式</p>
                <p>支持格式: JPG, PNG, GIF, WebP</p>
            </div>
        `;
    }

    // 显示无结果状态
    showNoResultsState() {
        this.imageGrid.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🔍</div>
                <h3>没有匹配的结果</h3>
                <p>尝试调整搜索条件或筛选器</p>
            </div>
        `;
    }

    // 创建占位图片
    createPlaceholderImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 300;
        canvas.height = 200;
        
        // 绘制占位图
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('图片加载失败', canvas.width / 2, canvas.height / 2);
        
        return canvas.toDataURL();
    }

    // 显示消息
    showMessage(message, type = 'info') {
        this.exportManager.showMessage(message, type);
    }

    // 开发者工具 - 内存监控 (在构造函数中调用)
    initMemoryMonitor() {
        // 仅在开发环境或URL包含debug参数时启用
        const isDebugMode = window.location.search.includes('debug=true') || 
                           window.location.hostname === 'localhost';
        
        if (!isDebugMode) return;

        // 添加内存监控快捷键 Ctrl+M
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                this.showMemoryInfo();
            }
        });

        // 定期内存检查 (每30秒)
        setInterval(() => {
            const memoryInfo = this.fileScanner.getMemoryUsageEstimate();
            if (memoryInfo.totalMemory > 300 * 1024 * 1024) { // 超过300MB
                console.warn('🐱 nya~ 内存使用警告:', memoryInfo.formatted.total);
            }
        }, 30000);

        console.log('🐱 nya~ 内存监控已启用! 按 Ctrl+M 查看内存使用详情');
    }

    // 显示内存使用详情
    showMemoryInfo() {
        const memoryInfo = this.fileScanner.getMemoryUsageEstimate();
        
        console.group('🐱 nya~ 内存使用详情');
        console.log('缩略图内存:', memoryInfo.formatted.thumbnail);
        console.log('对象内存:', memoryInfo.formatted.object);
        console.log('总内存:', memoryInfo.formatted.total);
        console.log('缩略图缓存数量:', memoryInfo.thumbnailCount);
        console.log('图片对象数量:', memoryInfo.imageCount);
        
        // 浏览器内存API (如果可用)
        if (performance.memory) {
            const browserMemory = performance.memory;
            console.log('浏览器内存使用:', {
                used: Math.round(browserMemory.usedJSHeapSize / 1024 / 1024) + 'MB',
                total: Math.round(browserMemory.totalJSHeapSize / 1024 / 1024) + 'MB',
                limit: Math.round(browserMemory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
            });
        }
        
        console.groupEnd();
        
        // 在UI中显示
        this.showMessage(
            `内存使用: ${memoryInfo.formatted.total} | 缓存: ${memoryInfo.thumbnailCount} 张`, 
            'info'
        );
    }
}

// 添加样式
function addDragDropStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .drag-highlight {
            background: rgba(102, 126, 234, 0.1) !important;
        }
        
        .drag-highlight::before {
            content: '📁 拖拽文件夹到此处';
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 20px 40px;
            border-radius: 12px;
            font-size: 18px;
            font-weight: 600;
            z-index: 10000;
            pointer-events: none;
        }
        
        .empty-state {
            grid-column: 1 / -1;
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }
        
        .empty-icon {
            font-size: 4rem;
            margin-bottom: 20px;
        }
        
        .empty-state h3 {
            font-size: 1.5rem;
            margin-bottom: 10px;
            color: #495057;
        }
        
        .empty-state p {
            margin: 5px 0;
            color: #6c757d;
        }
    `;
    document.head.appendChild(style);
}

// DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    // 添加样式
    addDragDropStyles();
    
    // 初始化应用
    window.gallery = new LocalFolderGallery();
    
    console.log('本地文件夹画廊已初始化完成');
}); 