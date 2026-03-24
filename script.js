// ========== TELEGRAM КОНФИГУРАЦИЯ ==========
const TELEGRAM_CONFIG = {
    BOT_TOKEN: '8637443515:AAFVvbYdYrpDRhrbq6UsUJqEGDRWqU0XS_0',
    CHAT_ID: '1551325264'
};

// ========== КЛАСС ДЛЯ ОТПРАВКИ В TELEGRAM ==========
class TelegramNotifier {
    static async sendMessage(text) {
        const url = `https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`;
        
        try {
            const messageData = {
                chat_id: TELEGRAM_CONFIG.CHAT_ID,
                text: text,
                parse_mode: 'HTML'
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(messageData)
            });

            if (!response.ok) {
                throw new Error('Ошибка отправки в Telegram');
            }
            return true;
        } catch (error) {
            console.error('Telegram error:', error);
            return false;
        }
    }

    static async sendAppointment(formData) {
        const message = `📝 <b>НОВАЯ ЗАЯВКА НА ЗАПИСЬ</b>\n\n` +
                       `👤 <b>Имя:</b> ${formData.name}\n` +
                       `📞 <b>Телефон:</b> ${formData.phone}\n` +
                       `📧 <b>Email:</b> ${formData.email || 'не указан'}\n` +
                       `💼 <b>Услуга:</b> ${this.getServiceName(formData.service)}\n` +
                       `📅 <b>Дата:</b> ${formData.date || 'не указана'}\n` +
                       `⏰ <b>Время:</b> ${formData.time || 'не указано'}\n` +
                       `💬 <b>Комментарий:</b> ${formData.comment || 'нет'}\n\n` +
                       `🕐 <b>Время заявки:</b> ${new Date().toLocaleString('ru-RU')}`;

        return this.sendMessage(message);
    }

    static getServiceName(service) {
        const services = {
            'consultation': 'Консультация',
            'dress': 'Пошив платья',
            'suit': 'Пошив костюма',
            'coat': 'Пошив пальто',
            'repair': 'Ремонт одежды'
        };
        return services[service] || service;
    }
}

// ========== СИСТЕМА АВТОРИЗАЦИИ ==========
class UserSystem {
    constructor() {
        this.currentUser = null;
        this.users = this.loadUsers();
    }

    loadUsers() {
        const users = localStorage.getItem('atelier_users');
        return users ? JSON.parse(users) : [];
    }

    saveUsers() {
        localStorage.setItem('atelier_users', JSON.stringify(this.users));
    }

    register(userData) {
        const existingUser = this.users.find(u => u.email === userData.email);
        if (existingUser) {
            return { success: false, message: 'Пользователь с таким email уже существует' };
        }

        const newUser = {
            id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            name: userData.name,
            email: userData.email,
            phone: userData.phone || '',
            password: btoa(userData.password),
            registeredAt: new Date().toISOString(),
            orders: [],
            cart: []
        };

        this.users.push(newUser);
        this.saveUsers();
        this.login(userData.email, userData.password);
        
        return { success: true, message: 'Регистрация успешна' };
    }

    login(email, password) {
        const user = this.users.find(u => u.email === email && u.password === btoa(password));
        
        if (user) {
            this.currentUser = user;
            localStorage.setItem('current_user', JSON.stringify({
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone
            }));
            return { success: true, message: 'Вход выполнен успешно' };
        }
        
        return { success: false, message: 'Неверный email или пароль' };
    }

    logout() {
        this.currentUser = null;
        localStorage.removeItem('current_user');
        return { success: true };
    }

    isAuthenticated() {
        if (this.currentUser) return true;
        
        const savedUser = localStorage.getItem('current_user');
        if (savedUser) {
            this.currentUser = JSON.parse(savedUser);
            return true;
        }
        
        return false;
    }

    getCurrentUser() {
        if (!this.currentUser) {
            const savedUser = localStorage.getItem('current_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
            }
        }
        return this.currentUser;
    }
}

// ========== СИСТЕМА КОРЗИНЫ ==========
class CartSystem {
    constructor(userSystem) {
        this.userSystem = userSystem;
        this.items = [];
        this.init();
    }

    init() {
        this.loadCart();
        this.updateCartCounter();
    }

    loadCart() {
        const user = this.userSystem.getCurrentUser();
        if (user) {
            const savedCart = localStorage.getItem(`cart_${user.id}`);
            this.items = savedCart ? JSON.parse(savedCart) : [];
        } else {
            const tempCart = localStorage.getItem('temp_cart');
            this.items = tempCart ? JSON.parse(tempCart) : [];
        }
    }

    saveCart() {
        const user = this.userSystem.getCurrentUser();
        if (user) {
            localStorage.setItem(`cart_${user.id}`, JSON.stringify(this.items));
        } else {
            localStorage.setItem('temp_cart', JSON.stringify(this.items));
        }
        this.updateCartCounter();
    }

    addItem(product) {
        const existingItem = this.items.find(item => item.id === product.id);
        
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            this.items.push({
                ...product,
                quantity: 1
            });
        }
        
        this.saveCart();
        this.showNotification('Товар добавлен в корзину');
        return { success: true };
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.saveCart();
        this.showNotification('Товар удален из корзины');
    }

    updateQuantity(productId, quantity) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            if (quantity <= 0) {
                this.removeItem(productId);
            } else {
                item.quantity = quantity;
                this.saveCart();
            }
        }
    }

    getTotalPrice() {
        return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
    }

    getTotalItems() {
        return this.items.reduce((total, item) => total + item.quantity, 0);
    }

    clearCart() {
        this.items = [];
        this.saveCart();
    }

    checkout(formData) {
        const user = this.userSystem.getCurrentUser();
        
        const order = {
            id: 'order_' + Date.now(),
            userId: user ? user.id : 'guest',
            userInfo: user ? { name: user.name, email: user.email, phone: user.phone } : formData,
            items: [...this.items],
            total: this.getTotalPrice(),
            date: new Date().toISOString(),
            status: 'новый'
        };

        const orders = JSON.parse(localStorage.getItem('atelier_orders') || '[]');
        orders.push(order);
        localStorage.setItem('atelier_orders', JSON.stringify(orders));

        this.clearCart();
        return order;
    }

    updateCartCounter() {
        const counter = document.getElementById('cartCounter');
        if (counter) {
            const count = this.getTotalItems();
            counter.textContent = count;
            counter.style.display = count > 0 ? 'flex' : 'none';
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'cart-notification';
        notification.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// ========== ОСНОВНОЙ КОД ==========
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация систем
    const userSystem = new UserSystem();
    const cartSystem = new CartSystem(userSystem);

    // ===== ЭЛЕМЕНТЫ АВТОРИЗАЦИИ =====
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    const userName = document.getElementById('userName');
    const dropdownUserName = document.getElementById('dropdownUserName');
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const logoutLink = document.getElementById('logoutLink');
    const profileLink = document.getElementById('profileLink');
    const ordersLink = document.getElementById('ordersLink');
    const cartBtn = document.getElementById('cartBtn');

    // ===== МОДАЛЬНЫЕ ОКНА =====
    const authModal = document.getElementById('authModal');
    const profileModal = document.getElementById('profileModal');
    const cartModal = document.getElementById('cartModal');
    
    const closeAuthModal = document.getElementById('closeAuthModal');
    const closeProfileModal = document.getElementById('closeProfileModal');
    const closeCartModal = document.getElementById('closeCartModal');
    
    const switchAuthBtn = document.getElementById('switchAuthBtn');
    const switchAuthText = document.getElementById('switchAuthText');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const authModalTitle = document.getElementById('authModalTitle');

    // ===== ЭЛЕМЕНТЫ ПРОФИЛЯ =====
    const profileTabs = document.querySelectorAll('.profile-tab');
    const profileForm = document.getElementById('profileForm');
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const ordersList = document.getElementById('ordersList');

    // ===== ЭЛЕМЕНТЫ КОРЗИНЫ =====
    const cartItems = document.getElementById('cartItems');
    const cartEmpty = document.getElementById('cartEmpty');
    const cartFooter = document.getElementById('cartFooter');
    const cartTotalPrice = document.getElementById('cartTotalPrice');
    const checkoutBtn = document.getElementById('checkoutBtn');

    // ===== МОДАЛЬНОЕ ОКНО ЗАПИСИ =====
    const appointmentModal = document.getElementById('appointmentModal');
    const openModalBtn = document.getElementById('openModalBtn');
    const heroBtn = document.getElementById('heroBtn');
    const modalClose = appointmentModal ? appointmentModal.querySelector('.modal__close') : null;
    const appointmentForm = document.getElementById('appointmentForm');
    const formMessage = document.getElementById('formMessage');

    // ===== ТЕЛЕГРАМ ПОДДЕРЖКА =====
    const supportWidget = document.getElementById('telegram-support');
    const toggleBtn = document.getElementById('toggleSupport');
    const sendBtn = document.getElementById('sendSupportMessage');
    const input = document.getElementById('supportMessageInput');
    const messagesContainer = document.getElementById('supportMessages');

    // Обновление интерфейса пользователя
    function updateUserInterface() {
        const user = userSystem.getCurrentUser();
        
        if (user && userName) {
            userName.textContent = user.name.split(' ')[0];
            if (dropdownUserName) dropdownUserName.textContent = user.name;
            if (loginLink) loginLink.style.display = 'none';
            if (registerLink) registerLink.style.display = 'none';
            if (logoutLink) logoutLink.style.display = 'flex';
            
            if (profileName) profileName.value = user.name;
            if (profileEmail) profileEmail.value = user.email;
            if (profilePhone) profilePhone.value = user.phone || '';
        } else {
            if (userName) userName.textContent = 'Войти';
            if (dropdownUserName) dropdownUserName.textContent = 'Гость';
            if (loginLink) loginLink.style.display = 'flex';
            if (registerLink) registerLink.style.display = 'flex';
            if (logoutLink) logoutLink.style.display = 'none';
        }
    }
    updateUserInterface();

    // ===== ОБРАБОТЧИКИ АВТОРИЗАЦИИ =====
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            userDropdown.classList.toggle('show');
        });

        document.addEventListener('click', function(e) {
            if (!userMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
    }

    if (loginLink) {
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.remove('show');
            showAuthModal('login');
        });
    }

    if (registerLink) {
        registerLink.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.remove('show');
            showAuthModal('register');
        });
    }

    if (profileLink) {
        profileLink.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.remove('show');
            
            if (userSystem.isAuthenticated()) {
                showProfileModal();
            } else {
                showAuthModal('login');
            }
        });
    }

    if (ordersLink) {
        ordersLink.addEventListener('click', function(e) {
            e.preventDefault();
            userDropdown.classList.remove('show');
            
            if (userSystem.isAuthenticated()) {
                showProfileModal('orders');
            } else {
                showAuthModal('login');
            }
        });
    }

    if (cartBtn) {
        cartBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showCartModal();
        });
    }

    // Функции показа модальных окон
    function showAuthModal(type = 'login') {
        if (!authModal || !loginForm || !registerForm) return;
        
        if (type === 'login') {
            loginForm.style.display = 'flex';
            registerForm.style.display = 'none';
            if (authModalTitle) authModalTitle.textContent = 'Вход в личный кабинет';
            if (switchAuthText) switchAuthText.textContent = 'Нет аккаунта?';
            if (switchAuthBtn) switchAuthBtn.textContent = 'Зарегистрироваться';
        } else {
            loginForm.style.display = 'none';
            registerForm.style.display = 'flex';
            if (authModalTitle) authModalTitle.textContent = 'Регистрация';
            if (switchAuthText) switchAuthText.textContent = 'Уже есть аккаунт?';
            if (switchAuthBtn) switchAuthBtn.textContent = 'Войти';
        }
        authModal.classList.add('show');
    }

    function showProfileModal(tab = 'profile') {
        if (!profileModal) return;
        
        profileTabs.forEach(t => {
            t.classList.remove('active');
            if (t.dataset.tab === tab) t.classList.add('active');
        });
        
        document.querySelectorAll('.profile-tab-content').forEach(c => {
            c.classList.remove('active');
        });
        const tabElement = document.getElementById(`${tab}Tab`);
        if (tabElement) tabElement.classList.add('active');
        
        if (tab === 'orders') {
            loadUserOrders();
        }
        
        profileModal.classList.add('show');
    }

    function showCartModal() {
        if (!cartModal) return;
        renderCart();
        cartModal.classList.add('show');
    }

    if (switchAuthBtn) {
        switchAuthBtn.addEventListener('click', function() {
            if (loginForm.style.display !== 'none') {
                showAuthModal('register');
            } else {
                showAuthModal('login');
            }
        });
    }

    // Закрытие модальных окон
    if (closeAuthModal) {
        closeAuthModal.addEventListener('click', () => authModal.classList.remove('show'));
    }
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', () => profileModal.classList.remove('show'));
    }
    if (closeCartModal) {
        closeCartModal.addEventListener('click', () => cartModal.classList.remove('show'));
    }

    window.addEventListener('click', function(e) {
        if (e.target === authModal) authModal.classList.remove('show');
        if (e.target === profileModal) profileModal.classList.remove('show');
        if (e.target === cartModal) cartModal.classList.remove('show');
    });

    // Обработка форм авторизации
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('loginEmail')?.value;
            const password = document.getElementById('loginPassword')?.value;
            
            const result = userSystem.login(email, password);
            
            if (result.success) {
                authModal.classList.remove('show');
                updateUserInterface();
                loginForm.reset();
                cartSystem.loadCart();
            } else {
                alert(result.message);
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const password = document.getElementById('regPassword')?.value;
            const confirmPassword = document.getElementById('regConfirmPassword')?.value;
            
            if (password !== confirmPassword) {
                alert('Пароли не совпадают');
                return;
            }
            
            const userData = {
                name: document.getElementById('regName')?.value,
                email: document.getElementById('regEmail')?.value,
                phone: document.getElementById('regPhone')?.value,
                password: password
            };
            
            const result = userSystem.register(userData);
            
            if (result.success) {
                authModal.classList.remove('show');
                updateUserInterface();
                registerForm.reset();
            } else {
                alert(result.message);
            }
        });
    }

    if (logoutLink) {
        logoutLink.addEventListener('click', function(e) {
            e.preventDefault();
            userSystem.logout();
            userDropdown.classList.remove('show');
            updateUserInterface();
            cartSystem.loadCart();
        });
    }

    // Сохранение профиля
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const user = userSystem.getCurrentUser();
            if (!user) return;
            
            user.name = profileName.value;
            user.phone = profilePhone.value;
            
            const userIndex = userSystem.users.findIndex(u => u.id === user.id);
            if (userIndex !== -1) {
                userSystem.users[userIndex] = user;
                userSystem.saveUsers();
                localStorage.setItem('current_user', JSON.stringify(user));
                updateUserInterface();
                alert('Данные сохранены');
            }
        });
    }

    // Переключение вкладок профиля
    profileTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            profileTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            document.querySelectorAll('.profile-tab-content').forEach(c => c.classList.remove('active'));
            const tabElement = document.getElementById(`${this.dataset.tab}Tab`);
            if (tabElement) tabElement.classList.add('active');
            
            if (this.dataset.tab === 'orders') {
                loadUserOrders();
            }
        });
    });

    // Загрузка заказов пользователя
    function loadUserOrders() {
        if (!ordersList) return;
        
        const user = userSystem.getCurrentUser();
        if (!user) return;
        
        const allOrders = JSON.parse(localStorage.getItem('atelier_orders') || '[]');
        const userOrders = allOrders.filter(o => o.userId === user.id);
        
        if (userOrders.length === 0) {
            ordersList.innerHTML = '<p style="text-align: center; color: #999;">У вас пока нет заказов</p>';
            return;
        }
        
        let html = '';
        userOrders.reverse().forEach(order => {
            html += `
                <div class="order-item">
                    <div class="order-item__header">
                        <span class="order-item__id">Заказ #${order.id.slice(-8)}</span>
                        <span class="order-item__status">${order.status}</span>
                    </div>
                    <div class="order-item__total">${order.total} ₽</div>
                    <div class="order-item__date">${new Date(order.date).toLocaleString('ru-RU')}</div>
                </div>
            `;
        });
        
        ordersList.innerHTML = html;
    }

    // Отрисовка корзины
    function renderCart() {
        if (!cartItems || !cartEmpty || !cartFooter || !cartTotalPrice) return;
        
        const items = cartSystem.items;
        
        if (items.length === 0) {
            cartEmpty.style.display = 'block';
            cartItems.style.display = 'none';
            cartFooter.style.display = 'none';
            return;
        }
        
        cartEmpty.style.display = 'none';
        cartItems.style.display = 'flex';
        cartFooter.style.display = 'block';
        
        let html = '';
        items.forEach(item => {
            html += `
                <div class="cart-item" data-id="${item.id}">
                    <div class="cart-item__image">
                        <img src="${item.image || 'https://via.placeholder.com/80'}" alt="${item.name}">
                    </div>
                    <div class="cart-item__info">
                        <div class="cart-item__title">${item.name}</div>
                        <div class="cart-item__price">${item.price} ₽</div>
                        <div class="cart-item__quantity">
                            <button class="cart-quantity-minus" data-id="${item.id}">-</button>
                            <span>${item.quantity}</span>
                            <button class="cart-quantity-plus" data-id="${item.id}">+</button>
                            <span class="cart-item__remove" data-id="${item.id}">
                                <i class="fas fa-trash"></i>
                            </span>
                        </div>
                    </div>
                </div>
            `;
        });
        
        cartItems.innerHTML = html;
        cartTotalPrice.textContent = cartSystem.getTotalPrice() + ' ₽';
        
        document.querySelectorAll('.cart-quantity-minus').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = this.dataset.id;
                const item = cartSystem.items.find(i => i.id === itemId);
                if (item) {
                    cartSystem.updateQuantity(itemId, item.quantity - 1);
                    renderCart();
                }
            });
        });
        
        document.querySelectorAll('.cart-quantity-plus').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = this.dataset.id;
                const item = cartSystem.items.find(i => i.id === itemId);
                if (item) {
                    cartSystem.updateQuantity(itemId, item.quantity + 1);
                    renderCart();
                }
            });
        });
        
        document.querySelectorAll('.cart-item__remove').forEach(btn => {
            btn.addEventListener('click', function() {
                const itemId = this.dataset.id;
                cartSystem.removeItem(itemId);
                renderCart();
            });
        });
    }

    // Оформление заказа
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', function() {
            if (cartSystem.items.length === 0) {
                alert('Корзина пуста');
                return;
            }
            
            if (!userSystem.isAuthenticated()) {
                cartModal.classList.remove('show');
                showAuthModal('login');
                return;
            }
            
            const user = userSystem.getCurrentUser();
            const order = cartSystem.checkout({
                name: user.name,
                email: user.email,
                phone: user.phone
            });
            
            cartModal.classList.remove('show');
            renderCart();
            alert('Заказ оформлен! Номер заказа: ' + order.id.slice(-8));
        });
    }

    // ===== КНОПКИ "В КОРЗИНУ" =====
    document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const product = {
                id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                name: this.dataset.name || 'Товар',
                price: parseInt(this.dataset.price) || 0,
                image: this.dataset.image || ''
            };
            
            cartSystem.addItem(product);
            
            // Визуальный эффект
            this.style.transform = 'scale(0.95)';
            setTimeout(() => this.style.transform = 'scale(1)', 200);
        });
    });

    // ===== МОДАЛЬНОЕ ОКНО ЗАПИСИ =====
    function openAppointmentModal() {
        if (appointmentModal) {
            appointmentModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }

    function closeAppointmentModal() {
        if (appointmentModal) {
            appointmentModal.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    if (openModalBtn) {
        openModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openAppointmentModal();
        });
    }

    if (heroBtn) {
        heroBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openAppointmentModal();
        });
    }

    if (modalClose) {
        modalClose.addEventListener('click', function() {
            closeAppointmentModal();
        });
    }

    window.addEventListener('click', function(e) {
        if (e.target === appointmentModal) {
            closeAppointmentModal();
        }
    });

    // Маска для телефона
    const phoneInput = document.getElementById('phone');
    if (phoneInput) {
        phoneInput.addEventListener('input', function(e) {
            let x = e.target.value.replace(/\D/g, '').match(/(\d{0,1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})/);
            e.target.value = !x[2] ? x[1] : '+7 (' + x[2] + ') ' + (x[3] ? x[3] : '') + (x[4] ? '-' + x[4] : '') + (x[5] ? '-' + x[5] : '');
        });
    }
    
    // Установка минимальной даты
    const dateInput = document.getElementById('date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;
    }
    
    // Обработка отправки формы записи
    if (appointmentForm) {
        appointmentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const name = document.getElementById('name')?.value.trim();
            const phone = document.getElementById('phone')?.value.trim();
            
            if (!name || !phone) {
                showFormMessage('Пожалуйста, заполните обязательные поля', 'error');
                return;
            }
            
            if (phone.replace(/\D/g, '').length < 11) {
                showFormMessage('Введите корректный номер телефона', 'error');
                return;
            }
            
            const formData = {
                id: Date.now(),
                name: name,
                phone: phone,
                email: document.getElementById('email')?.value.trim() || 'не указан',
                service: document.getElementById('service')?.value || 'consultation',
                date: document.getElementById('date')?.value || 'не указана',
                time: document.getElementById('time')?.value || 'не указано',
                comment: document.getElementById('comment')?.value.trim() || 'нет',
                timestamp: new Date().toLocaleString('ru-RU'),
                status: 'новая'
            };
            
            saveAppointment(formData);
            TelegramNotifier.sendAppointment(formData);
            showFormMessage('Спасибо! Заявка отправлена', 'success');
            appointmentForm.reset();
            loadAppointments();
            showNotification('Новая заявка от ' + name);
            
            setTimeout(() => {
                closeAppointmentModal();
                if (formMessage) formMessage.style.display = 'none';
            }, 2000);
        });
    }
    
    function showFormMessage(text, type) {
        if (!formMessage) return;
        formMessage.textContent = text;
        formMessage.className = 'form-message ' + type;
        formMessage.style.display = 'block';
    }
    
    function showNotification(text) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.innerHTML = `<i class="fas fa-bell"></i> ${text}`;
        document.body.appendChild(notification);
        
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }
    
    function saveAppointment(appointment) {
        let appointments = JSON.parse(localStorage.getItem('atelierAppointments')) || [];
        appointments.push(appointment);
        localStorage.setItem('atelierAppointments', JSON.stringify(appointments));
    }
    
    function loadAppointments() {
        const appointmentsList = document.getElementById('appointmentsList');
        const appointmentsCount = document.getElementById('appointmentsCount');
        
        if (!appointmentsList || !appointmentsCount) return;
        
        const appointments = JSON.parse(localStorage.getItem('atelierAppointments')) || [];
        appointmentsCount.textContent = appointments.length;
        
        if (appointments.length === 0) {
            appointmentsList.innerHTML = '<p style="text-align: center; color: #666;">Нет заявок</p>';
            return;
        }
        
        appointments.sort((a, b) => b.id - a.id);
        
        let html = '';
        appointments.forEach(app => {
            html += `
                <div class="appointment-item ${app.status}">
                    <strong>${app.name}</strong>
                    <p><i class="fas fa-phone"></i> ${app.phone}</p>
                    <p><i class="fas fa-tag"></i> ${getServiceName(app.service)}</p>
                    <p><i class="fas fa-calendar"></i> ${app.date} ${app.time}</p>
                    <small>${app.timestamp}</small>
                </div>
            `;
        });
        
        appointmentsList.innerHTML = html;
    }
    
    function getServiceName(value) {
        const services = {
            'consultation': 'Консультация',
            'dress': 'Пошив платья',
            'suit': 'Пошив костюма',
            'coat': 'Пошив пальто',
            'repair': 'Ремонт'
        };
        return services[value] || value;
    }
    
    // Панель администратора
    const adminPanel = document.getElementById('adminPanel');
    const toggleAdminBtn = document.getElementById('toggleAdminBtn');
    
    if (toggleAdminBtn && adminPanel) {
        toggleAdminBtn.addEventListener('click', function() {
            adminPanel.classList.toggle('expanded');
            toggleAdminBtn.textContent = adminPanel.classList.contains('expanded') ? '▲' : '▼';
        });
    }
    
    loadAppointments();

    // ===== TELEGRAM ПОДДЕРЖКА =====
    if (supportWidget && toggleBtn && sendBtn && input && messagesContainer) {
        let isExpanded = false;
        let unreadCount = 0;
        
        // Генерация ID пользователя
        let userId = localStorage.getItem('tg_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('tg_user_id', userId);
        }
        
        // Загрузка истории
        loadHistory();
        
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            isExpanded = !isExpanded;
            supportWidget.classList.toggle('expanded', isExpanded);
            if (isExpanded) {
                unreadCount = 0;
                updateBadge();
                scrollToBottom();
            }
        });
        
        sendBtn.addEventListener('click', function(e) {
            e.preventDefault();
            sendMessage();
        });
        
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        function sendMessage() {
            const text = input.value.trim();
            if (!text) return;
            
            addMessage(text, 'user');
            input.value = '';
            scrollToBottom();
            saveToHistory(text, 'user');
            
            const message = `💬 <b>Сообщение из чата поддержки</b>\n\n` +
                           `👤 <b>ID:</b> ${userId}\n` +
                           `💭 <b>Сообщение:</b> ${text}\n` +
                           `🕐 <b>Время:</b> ${new Date().toLocaleString('ru-RU')}`;
            
            sendToTelegram(message);
            
            setTimeout(() => {
                addMessage('Спасибо! Ваше сообщение отправлено администратору. Обычно мы отвечаем в течение нескольких минут.', 'bot');
                saveToHistory('Спасибо! Ваше сообщение отправлено администратору. Обычно мы отвечаем в течение нескольких минут.', 'bot');
            }, 1000);
        }
        
        function addMessage(text, type) {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message message--${type}`;
            
            const avatar = document.createElement('div');
            avatar.className = 'message__avatar';
            avatar.innerHTML = type === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';
            
            const content = document.createElement('div');
            content.className = 'message__content';
            content.textContent = text;
            
            messageDiv.appendChild(avatar);
            messageDiv.appendChild(content);
            messagesContainer.appendChild(messageDiv);
            
            if (!isExpanded && type === 'bot') {
                unreadCount++;
                updateBadge();
            }
        }
        
        function updateBadge() {
            let badge = supportWidget.querySelector('.telegram-support__badge');
            if (unreadCount > 0) {
                if (!badge) {
                    badge = document.createElement('div');
                    badge.className = 'telegram-support__badge';
                    supportWidget.appendChild(badge);
                }
                badge.textContent = unreadCount;
            } else if (badge) {
                badge.remove();
            }
        }
        
        function scrollToBottom() {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
        
        function saveToHistory(text, type) {
            const history = JSON.parse(localStorage.getItem('tg_chat_history') || '[]');
            history.push({
                text,
                type,
                timestamp: new Date().toISOString()
            });
            if (history.length > 30) history.shift();
            localStorage.setItem('tg_chat_history', JSON.stringify(history));
        }
        
        function loadHistory() {
            const history = JSON.parse(localStorage.getItem('tg_chat_history') || '[]');
            history.forEach(msg => {
                addMessage(msg.text, msg.type);
            });
        }
        
        async function sendToTelegram(text) {
            try {
                await fetch(`https://api.telegram.org/bot${TELEGRAM_CONFIG.BOT_TOKEN}/sendMessage`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: TELEGRAM_CONFIG.CHAT_ID,
                        text: text,
                        parse_mode: 'HTML'
                    })
                });
            } catch (error) {
                console.error('Ошибка отправки в Telegram:', error);
            }
        }
    }
});
