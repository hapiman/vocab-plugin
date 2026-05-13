import UIKit
import UIKit.UIGestureRecognizerSubclass

/// Pan gesture that only activates on horizontal movement > threshold,
/// allowing tap gestures to fire for short/vertical touches.
private final class PanDirectionGestureRecognizer: UIPanGestureRecognizer {
    private let threshold: CGFloat = 10
    private var initialPoint: CGPoint = .zero
    private var decided = false

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesBegan(touches, with: event)
        initialPoint = touches.first?.location(in: view) ?? .zero
        decided = false
    }

    override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent) {
        super.touchesMoved(touches, with: event)
        guard !decided, let touch = touches.first else { return }
        let current = touch.location(in: view)
        let dx = abs(current.x - initialPoint.x)
        let dy = abs(current.y - initialPoint.y)

        if dx > threshold && dx > dy {
            decided = true
            // Horizontal pan confirmed - gesture continues
        } else if dy > threshold {
            decided = true
            state = .failed
        }
    }

    override func reset() {
        super.reset()
        decided = false
    }
}

final class ReviewViewController: UIViewController {
    private let store = VocabStore.shared
    private let cardView = ReviewCardView()
    private let emptyView = EmptyStateView()
    private let actionStack = UIStackView()
    private let masteredButton = GradientButton()
    private let progressLabel = UILabel()

    private var queue: [(String, VocabWord)] = []
    private var currentIndex = 0
    private var answerVisible = false

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "复习"
        view.backgroundColor = Theme.Colors.pageBackground
        setupViews()
        setupSwipeGestures()
        reloadQueue()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.interactivePopGestureRecognizer?.isEnabled = false
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        navigationController?.interactivePopGestureRecognizer?.isEnabled = true
    }

    private func setupViews() {
        // Progress indicator
        progressLabel.font = Theme.Font.caption
        progressLabel.textColor = Theme.Colors.subtleText
        progressLabel.textAlignment = .center
        progressLabel.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(progressLabel)

        cardView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(cardView)

        emptyView.configure(title: "暂无到期单词", message: "PC 浏览器扩展收词后，手机端会从 Gist 同步复习队列。")
        emptyView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(emptyView)

        // Action buttons (review outcomes) - shown after answer is visible
        actionStack.axis = .horizontal
        actionStack.distribution = .fillEqually
        actionStack.spacing = Theme.Spacing.sm
        actionStack.isHidden = true

        let outcomes: [(String, String, UIColor, ReviewOutcome)] = [
            ("忘了", "xmark.circle.fill", Theme.Colors.statDue, .miss),
            ("模糊", "questionmark.circle.fill", .systemOrange, .hard),
            ("记得", "checkmark.circle.fill", Theme.Colors.statMastered, .good)
        ]

        outcomes.forEach { title, icon, color, outcome in
            let button = makeActionButton(title: title, icon: icon, color: color)
            button.addAction(UIAction { [weak self] _ in
                Theme.animatePress(button) {
                    self?.complete(outcome)
                }
            }, for: .touchUpInside)
            actionStack.addArrangedSubview(button)
        }

        // Toggle mastered/learning button - same style as WordDetail primary button
        Theme.applyPrimaryStyle(to: masteredButton)
        masteredButton.addTarget(self, action: #selector(toggleMastered), for: .touchUpInside)
        masteredButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        masteredButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        // Hint label
        let hintLabel = UILabel()
        hintLabel.text = "点击卡片翻转 · 左右滑动切换"
        hintLabel.font = Theme.Font.small
        hintLabel.textColor = Theme.Colors.subtleText.withAlphaComponent(0.5)
        hintLabel.textAlignment = .center

        let bottomStack = UIStackView(arrangedSubviews: [
            actionStack,
            masteredButton,
            hintLabel
        ])
        bottomStack.axis = .vertical
        bottomStack.spacing = Theme.Spacing.md
        bottomStack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(bottomStack)

        NSLayoutConstraint.activate([
            progressLabel.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: Theme.Spacing.sm),
            progressLabel.centerXAnchor.constraint(equalTo: view.centerXAnchor),

            cardView.topAnchor.constraint(equalTo: progressLabel.bottomAnchor, constant: Theme.Spacing.md),
            cardView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Theme.Spacing.xl),
            cardView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -Theme.Spacing.xl),
            cardView.bottomAnchor.constraint(equalTo: bottomStack.topAnchor, constant: -Theme.Spacing.lg),

            emptyView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            emptyView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            emptyView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            emptyView.bottomAnchor.constraint(equalTo: bottomStack.topAnchor),

            bottomStack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Theme.Spacing.xl),
            bottomStack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -Theme.Spacing.xl),
            bottomStack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -Theme.Spacing.lg),

            actionStack.heightAnchor.constraint(equalToConstant: 48)
        ])
    }

    // MARK: - Swipe & Tap Gestures

    private func setupSwipeGestures() {
        let pan = PanDirectionGestureRecognizer(target: self, action: #selector(handlePan(_:)))
        cardView.addGestureRecognizer(pan)

        let tap = UITapGestureRecognizer(target: self, action: #selector(handleCardTap))
        tap.require(toFail: pan)
        cardView.addGestureRecognizer(tap)
    }

    @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
        switch gesture.state {
        case .changed:
            let translation = gesture.translation(in: cardView)
            let offsetX = translation.x * 0.3
            cardView.transform = CGAffineTransform(translationX: offsetX, y: 0)
        case .ended, .cancelled:
            let translation = gesture.translation(in: cardView)

            UIView.animate(withDuration: 0.15) {
                self.cardView.transform = .identity
            }

            if translation.x > 50 {
                swipeToPrevious()
            } else if translation.x < -50 {
                swipeToNext()
            }
        default:
            break
        }
    }

    @objc private func handleCardTap() {
        tapToFlip()
    }

    private func swipeToPrevious() {
        guard currentIndex > 0 else { return }
        currentIndex -= 1
        answerVisible = false

        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseIn) {
            self.cardView.transform = CGAffineTransform(translationX: 30, y: 0)
            self.cardView.alpha = 0
        } completion: { _ in
            self.renderCurrent()
            self.cardView.transform = CGAffineTransform(translationX: -30, y: 0)
            UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseOut) {
                self.cardView.transform = .identity
                self.cardView.alpha = 1
            }
        }
    }

    private func swipeToNext() {
        guard currentIndex < queue.count else { return }
        currentIndex += 1
        answerVisible = false

        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseIn) {
            self.cardView.transform = CGAffineTransform(translationX: -30, y: 0)
            self.cardView.alpha = 0
        } completion: { _ in
            self.renderCurrent()
            self.cardView.transform = CGAffineTransform(translationX: 30, y: 0)
            UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseOut) {
                self.cardView.transform = .identity
                self.cardView.alpha = 1
            }
        }
    }

    private func tapToFlip() {
        guard currentIndex < queue.count else { return }
        answerVisible.toggle()
        let item = queue[currentIndex]
        cardView.configure(word: item.0, info: item.1, answerVisible: answerVisible)
        actionStack.isHidden = !answerVisible
    }

    // MARK: - Actions

    @objc private func toggleMastered() {
        guard currentIndex < queue.count else { return }
        let word = queue[currentIndex].0
        let info = queue[currentIndex].1
        let isMastered = info.status == "mastered"

        if isMastered {
            // Revert to learning
            store.updateStatus(word: word, status: "learning")
            if let updated = store.words[word] {
                queue[currentIndex] = (word, updated)
            }
            renderCurrent()
        } else {
            // Mark as mastered
            _ = store.applyReview(word: word, outcome: .mastered)
            if let updated = store.words[word] {
                queue[currentIndex] = (word, updated)
            }

            // Show mastered feedback overlay
            showMasteredOverlay()

            // Advance after brief delay
            currentIndex += 1
            answerVisible = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                self?.renderCurrent()
            }
        }
    }

    private func showMasteredOverlay() {
        let overlay = UIView()
        overlay.backgroundColor = Theme.Colors.statMastered.withAlphaComponent(0.15)
        overlay.layer.cornerRadius = Theme.Radius.large
        overlay.frame = cardView.frame
        overlay.alpha = 0
        view.addSubview(overlay)

        let checkmark = UIImageView(image: UIImage(systemName: "checkmark.circle.fill"))
        checkmark.tintColor = Theme.Colors.statMastered
        checkmark.contentMode = .scaleAspectFit
        checkmark.frame = CGRect(x: 0, y: 0, width: 48, height: 48)
        checkmark.center = CGPoint(x: overlay.bounds.midX, y: overlay.bounds.midY - 12)
        checkmark.transform = CGAffineTransform(scaleX: 0.5, y: 0.5)
        overlay.addSubview(checkmark)

        let label = UILabel()
        label.text = "已掌握"
        label.font = UIFont.systemFont(ofSize: 15, weight: .semibold)
        label.textColor = Theme.Colors.statMastered
        label.sizeToFit()
        label.center = CGPoint(x: overlay.bounds.midX, y: overlay.bounds.midY + 24)
        overlay.addSubview(label)

        UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseOut) {
            overlay.alpha = 1
            checkmark.transform = .identity
        } completion: { _ in
            UIView.animate(withDuration: 0.3, delay: 0.4, options: .curveEaseIn) {
                overlay.alpha = 0
                overlay.transform = CGAffineTransform(scaleX: 0.95, y: 0.95)
            } completion: { _ in
                overlay.removeFromSuperview()
            }
        }
    }

    private func reloadQueue() {
        queue = store.sortedDueQueue.shuffled()
        currentIndex = 0
        answerVisible = false
        renderCurrent()
    }

    private func renderCurrent() {
        guard currentIndex < queue.count else {
            cardView.isHidden = true
            emptyView.isHidden = false
            actionStack.isHidden = true
            masteredButton.isHidden = true
            progressLabel.isHidden = true
            return
        }

        progressLabel.isHidden = false
        progressLabel.text = "\(currentIndex + 1) / \(queue.count)"

        let item = queue[currentIndex]
        cardView.isHidden = false
        emptyView.isHidden = true
        masteredButton.isHidden = false
        actionStack.isHidden = !answerVisible
        cardView.configure(word: item.0, info: item.1, answerVisible: answerVisible)

        // Toggle button text - same as WordDetail primary button
        let isMastered = item.1.status == "mastered"
        if isMastered {
            masteredButton.setTitle("重新学习", for: .normal)
        } else {
            masteredButton.setTitle("标记已掌握", for: .normal)
        }
    }

    private func complete(_ outcome: ReviewOutcome) {
        guard currentIndex < queue.count else { return }
        let word = queue[currentIndex].0
        _ = store.applyReview(word: word, outcome: outcome)
        if let updated = store.words[word] {
            queue[currentIndex] = (word, updated)
        }
        currentIndex += 1
        answerVisible = false

        UIView.animate(withDuration: 0.2, delay: 0, options: .curveEaseIn) {
            self.cardView.transform = CGAffineTransform(translationX: -30, y: 0)
            self.cardView.alpha = 0
        } completion: { _ in
            self.renderCurrent()
            self.cardView.transform = CGAffineTransform(translationX: 30, y: 0)
            UIView.animate(withDuration: 0.25, delay: 0, options: .curveEaseOut) {
                self.cardView.transform = .identity
                self.cardView.alpha = 1
            }
        }
    }

    private func makeActionButton(title: String, icon: String, color: UIColor) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(" \(title)", for: .normal)
        button.setImage(UIImage(systemName: icon), for: .normal)
        button.titleLabel?.font = UIFont.systemFont(ofSize: 14, weight: .semibold)
        button.backgroundColor = color.withAlphaComponent(0.12)
        button.tintColor = color
        button.layer.cornerRadius = Theme.Radius.small
        return button
    }

    // MARK: - Button Feedback

    @objc private func buttonTouchDown(_ sender: UIButton) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseIn) {
            sender.transform = CGAffineTransform(scaleX: 0.96, y: 0.96)
        }
    }

    @objc private func buttonTouchUp(_ sender: UIButton) {
        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseOut) {
            sender.transform = .identity
        }
    }
}
