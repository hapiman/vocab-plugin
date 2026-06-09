import UIKit

final class HomeViewController: UIViewController {
    private let store = VocabStore.shared
    private let statsView = StatSummaryView()
    private let syncLabel = UILabel()
    private let errorLabel = UILabel()
    private let startButton = GradientButton()
    private let syncButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = Theme.Colors.pageBackground
        setupViews()
        setupStatTaps()
        store.loadCachedWords()
        refresh()

        Task {
            await store.pullFromGist()
            refresh()
        }
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        refresh()
    }

    private func setupViews() {
        // Header section with greeting
        let greetingLabel = UILabel()
        greetingLabel.text = greetingText()
        greetingLabel.font = Theme.Font.largeTitle
        greetingLabel.textColor = .label

        let subtitleLabel = UILabel()
        subtitleLabel.text = "今天也要坚持复习哦"
        subtitleLabel.font = Theme.Font.callout
        subtitleLabel.textColor = Theme.Colors.subtleText

        let headerStack = UIStackView(arrangedSubviews: [greetingLabel, subtitleLabel])
        headerStack.axis = .vertical
        headerStack.spacing = Theme.Spacing.xs

        // Start review button
        startButton.setTitle("开始复习", for: .normal)
        Theme.applyPrimaryStyle(to: startButton)
        startButton.addTarget(self, action: #selector(startReview), for: .touchUpInside)
        startButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        startButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        // Sync button
        syncButton.setTitle("  同步 Gist", for: .normal)
        syncButton.setImage(UIImage(systemName: "arrow.triangle.2.circlepath"), for: .normal)
        Theme.applySecondaryStyle(to: syncButton)
        syncButton.addTarget(self, action: #selector(syncGist), for: .touchUpInside)
        syncButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        syncButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        // Status labels
        syncLabel.font = Theme.Font.caption
        syncLabel.textColor = Theme.Colors.subtleText
        syncLabel.numberOfLines = 0
        syncLabel.textAlignment = .center

        errorLabel.font = Theme.Font.caption
        errorLabel.textColor = .systemRed
        errorLabel.numberOfLines = 0
        errorLabel.textAlignment = .center

        // Layout
        let stack = UIStackView(arrangedSubviews: [
            headerStack,
            statsView,
            startButton,
            syncButton,
            syncLabel,
            errorLabel
        ])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.xl
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.setCustomSpacing(Theme.Spacing.xxxl, after: headerStack)
        stack.setCustomSpacing(Theme.Spacing.xxxl, after: statsView)
        stack.setCustomSpacing(Theme.Spacing.md, after: syncButton)
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            statsView.heightAnchor.constraint(equalToConstant: 90),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: Theme.Spacing.xxl),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: Theme.Spacing.xl),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -Theme.Spacing.xl)
        ])

        // Animate entrance
        [headerStack, statsView, startButton, syncButton].enumerated().forEach { index, subview in
            Theme.animateFadeIn(subview, delay: Double(index) * 0.08)
        }
    }

    private func refresh() {
        statsView.configure(
            due: store.dueCount,
            learning: store.learningCount,
            mastered: store.masteredCount
        )

        if let lastSyncAt = store.lastSyncAt {
            syncLabel.text = "最近同步：\(DateCoding.localMinuteString(lastSyncAt))"
        } else {
            syncLabel.text = "尚未同步。请在设置页填写 GitHub Token 和 Gist ID。"
        }
        errorLabel.text = store.lastError
    }

    private func greetingText() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 6..<12: return "早上好"
        case 12..<14: return "中午好"
        case 14..<18: return "下午好"
        default: return "晚上好"
        }
    }

    private func setupStatTaps() {
        statsView.onTap = { [weak self] type in
            guard let self else { return }
            switch type {
            case .due:
                self.navigationController?.pushViewController(ReviewViewController(), animated: true)
            case .learning:
                self.tabBarController?.selectedIndex = 1
            case .mastered:
                self.navigationController?.pushViewController(VocabularyViewController(mode: .mastered), animated: true)
            }
        }
    }

    // MARK: - Actions

    @objc private func startReview() {
        navigationController?.pushViewController(ReviewViewController(), animated: true)
    }

    @objc private func syncGist() {
        // Rotate sync icon
        if let imageView = syncButton.imageView {
            UIView.animate(withDuration: 0.6, delay: 0, options: .curveEaseInOut) {
                imageView.transform = CGAffineTransform(rotationAngle: .pi)
            } completion: { _ in
                UIView.animate(withDuration: 0.6) {
                    imageView.transform = .identity
                }
            }
        }

        Task {
            await store.pushIfNeeded()
            await store.pullFromGist()
            refresh()
        }
    }

    // MARK: - Button Feedback

    @objc private func buttonTouchDown(_ sender: UIButton) {
        UIView.animate(withDuration: 0.1, delay: 0, options: .curveEaseIn) {
            sender.transform = CGAffineTransform(scaleX: 0.97, y: 0.97)
        }
    }

    @objc private func buttonTouchUp(_ sender: UIButton) {
        UIView.animate(withDuration: 0.15, delay: 0, options: .curveEaseOut) {
            sender.transform = .identity
        }
    }
}
