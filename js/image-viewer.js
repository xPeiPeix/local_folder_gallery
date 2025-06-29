// 图片查看器模块
class ImageViewer {
    constructor() {
        this.modal = null;
        this.modalImage = null;
        this.currentImages = [];
        this.currentIndex = 0;
        this.isOpen = false;
        
        this.initModal();
        this.bindEvents();
    }

    // 初始化弹窗
    initModal() {
        this.modal = document.getElementById('imageModal');
        this.modalImage = document.getElementById('modalImage');
        this.modalTitle = document.getElementById('modalTitle');
        this.closeBtn = this.modal.querySelector('.modal-close');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.addToSelectionBtn = document.getElementById('addToSelectionBtn');
        this.removeFromSelectionBtn = document.getElementById('removeFromSelectionBtn');
        
        // 信息显示元素
        this.infoName = document.getElementById('infoName');
        this.infoSize = document.getElementById('infoSize');
        this.infoDimensions = document.getElementById('infoDimensions');
        this.infoType = document.getElementById('infoType');
        this.infoPath = document.getElementById('infoPath');
    }

    // 绑定事件
    bindEvents() {
        // 关闭弹窗
        this.closeBtn.addEventListener('click', () => this.close());
        
        // 点击弹窗背景关闭
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // 阻止modal区域的拖拽事件，防止意外触发文件选择
        ['dragenter', 'dragover', 'dragleave', 'drop', 'dragstart'].forEach(eventName => {
            this.modal.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // 导航按钮
        this.prevBtn.addEventListener('click', () => this.showPrevious());
        this.nextBtn.addEventListener('click', () => this.showNext());

        // 键盘导航
        document.addEventListener('keydown', (e) => {
            if (!this.isOpen) return;
            
            switch (e.key) {
                case 'Escape':
                    this.close();
                    break;
                case 'ArrowLeft':
                    e.preventDefault();
                    this.showPrevious();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.showNext();
                    break;
                case ' ':
                    e.preventDefault();
                    this.showNext();
                    break;
            }
        });

        // 选择操作
        this.addToSelectionBtn.addEventListener('click', () => {
            this.toggleSelection(true);
        });

        this.removeFromSelectionBtn.addEventListener('click', () => {
            this.toggleSelection(false);
        });

        // 图片加载错误处理
        this.modalImage.addEventListener('error', () => {
            this.modalImage.src = this.createErrorImage();
        });

        // 阻止图片的拖拽行为，防止意外触发文件选择
        this.modalImage.addEventListener('dragstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.modalImage.addEventListener('drag', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        this.modalImage.addEventListener('dragend', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    }

    // 显示图片
    show(images, startIndex = 0) {
        console.log('🐱 nya~ 图片查看器正在打开，启用文件夹选择保护');
        this.currentImages = images;
        this.currentIndex = startIndex;
        this.isOpen = true;

        // 重置缩放状态 - 每次进入都是初始状态
        if (this.resetZoomState) {
            this.resetZoomState();
        }

        this.updateImage();
        this.updateNavigation();
        this.updateModalInfo();

        // 显示弹窗
        this.modal.classList.add('show');
        this.modal.style.display = 'flex';
        
        // 防止背景滚动
        document.body.style.overflow = 'hidden';
    }

    // 关闭弹窗
    close() {
        console.log('🐱 nya~ 图片查看器正在关闭，解除文件夹选择保护');
        this.isOpen = false;
        this.modal.classList.remove('show');
        this.modal.style.display = 'none';
        
        // 恢复背景滚动
        document.body.style.overflow = '';
    }

    // 显示上一张
    showPrevious() {
        if (this.currentImages.length === 0) return;
        
        this.currentIndex = (this.currentIndex - 1 + this.currentImages.length) % this.currentImages.length;
        this.updateImage();
        this.updateNavigation();
        this.updateModalInfo();
    }

    // 显示下一张
    showNext() {
        if (this.currentImages.length === 0) return;
        
        this.currentIndex = (this.currentIndex + 1) % this.currentImages.length;
        this.updateImage();
        this.updateNavigation();
        this.updateModalInfo();
    }

    // 更新图片显示
    updateImage() {
        if (this.currentImages.length === 0) return;
        
        const currentImage = this.currentImages[this.currentIndex];
        
        // 显示加载状态
        this.modalImage.style.opacity = '0.5';
        
        // 加载图片
        this.modalImage.onload = () => {
            this.modalImage.style.opacity = '1';
            // 切换图片时重置缩放状态
            if (this.resetZoomState) {
                this.resetZoomState();
            }
        };
        
        this.modalImage.src = currentImage.url;
        this.modalTitle.textContent = `${currentImage.name} (${this.currentIndex + 1}/${this.currentImages.length})`;
    }

    // 更新导航按钮状态
    updateNavigation() {
        const hasMultipleImages = this.currentImages.length > 1;
        
        this.prevBtn.style.display = hasMultipleImages ? 'flex' : 'none';
        this.nextBtn.style.display = hasMultipleImages ? 'flex' : 'none';
    }

    // 更新弹窗信息
    updateModalInfo() {
        if (this.currentImages.length === 0) return;
        
        const currentImage = this.currentImages[this.currentIndex];
        
        // 更新信息显示
        this.infoName.textContent = currentImage.name;
        this.infoSize.textContent = currentImage.sizeFormatted;
        this.infoDimensions.textContent = `${currentImage.dimensions.width} × ${currentImage.dimensions.height} px`;
        this.infoType.textContent = currentImage.type;
        this.infoPath.textContent = currentImage.path;
        
        // 更新选择按钮状态
        this.updateSelectionButtons(currentImage.selected);
    }

    // 更新选择按钮状态
    updateSelectionButtons(isSelected) {
        if (isSelected) {
            this.addToSelectionBtn.style.display = 'none';
            this.removeFromSelectionBtn.style.display = 'inline-block';
        } else {
            this.addToSelectionBtn.style.display = 'inline-block';
            this.removeFromSelectionBtn.style.display = 'none';
        }
    }

    // 切换选择状态
    toggleSelection(selected) {
        if (this.currentImages.length === 0) return;
        
        const currentImage = this.currentImages[this.currentIndex];
        currentImage.selected = selected;
        
        // 更新按钮状态
        this.updateSelectionButtons(selected);
        
        // 触发选择状态改变事件
        this.dispatchSelectionChangeEvent(currentImage);
        
        console.log(`🐱 nya~ 查看器中选择状态已更新: ${currentImage.name} - ${selected ? '已选择' : '未选择'}`);
    }

    // 触发选择状态改变事件
    dispatchSelectionChangeEvent(image) {
        const event = new CustomEvent('imageSelectionChanged', {
            detail: { image: image }
        });
        document.dispatchEvent(event);
    }

    // 创建错误图片
    createErrorImage() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 400;
        canvas.height = 300;
        
        // 绘制错误提示
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('图片加载失败', canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = '14px Arial';
        ctx.fillText('无法显示此图片', canvas.width / 2, canvas.height / 2 + 10);
        
        return canvas.toDataURL();
    }

    // 添加缩放功能
    enableZoom() {
        // 当前缩放状态 - 每次进入都重置
        let scale = 1;
        let translateX = 0;
        let translateY = 0;
        let isDragging = false;
        let startX, startY;

        // 重置缩放状态
        const resetZoomState = () => {
            scale = 1;
            translateX = 0;
            translateY = 0;
            this.updateImageTransform(scale, translateX, translateY);
        };

        // 保存重置方法供外部调用
        this.resetZoomState = resetZoomState;

        // 鼠标滚轮缩放
        this.modalImage.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            scale *= delta;
            
            // 限制缩放范围
            scale = Math.min(Math.max(0.5, scale), 5);
            
            this.updateImageTransform(scale, translateX, translateY);
        });

        // 双击重置
        this.modalImage.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            resetZoomState();
        });

        // 拖拽移动（仅在缩放时）
        this.modalImage.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (scale > 1) {
                isDragging = true;
                startX = e.clientX - translateX;
                startY = e.clientY - translateY;
                this.modalImage.style.cursor = 'grabbing';
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging && scale > 1) {
                translateX = e.clientX - startX;
                translateY = e.clientY - startY;
                this.updateImageTransform(scale, translateX, translateY);
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            this.modalImage.style.cursor = scale > 1 ? 'grab' : 'default';
        });
    }

    // 更新图片变换
    updateImageTransform(scale, translateX, translateY) {
        this.modalImage.style.transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
        this.modalImage.style.cursor = scale > 1 ? 'grab' : 'default';
    }

    // 获取当前图片
    getCurrentImage() {
        if (this.currentImages.length === 0) return null;
        return this.currentImages[this.currentIndex];
    }
} 