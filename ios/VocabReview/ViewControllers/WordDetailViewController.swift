import UIKit

final class WordDetailViewController: UIViewController {
    private let store = VocabStore.shared
    private let word: String

    private let statusBadge = UILabel()
    private let phoneticLabel = UILabel()
    private let definitionLabel = UILabel()
    private let contextLabel = UILabel()
    private let metaLabel = UILabel()
    private let primaryButton = GradientButton()
    private let secondaryButton = UIButton(type: .system)
    private let statusMessageLabel = UILabel()

    init(word: String) {
        self.word = word
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        title = word
        view.backgroundColor = Theme.Colors.pageBackground
        setupViews()
        render()
    }

    private func setupViews() {
        let wordLabel = UILabel()
        wordLabel.text = word
        wordLabel.font = Theme.Font.largeTitle
        wordLabel.textColor = .label
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = true
        wordLabel.minimumScaleFactor = 0.7

        statusBadge.font = UIFont.systemFont(ofSize: 12, weight: .semibold)
        statusBadge.textAlignment = .center
        statusBadge.layer.cornerRadius = 6
        statusBadge.clipsToBounds = true

        phoneticLabel.font = UIFont.systemFont(ofSize: 16, weight: .medium)
        phoneticLabel.textColor = Theme.Colors.subtleText

        definitionLabel.font = UIFont.systemFont(ofSize: 18, weight: .medium)
        definitionLabel.textColor = .label
        definitionLabel.numberOfLines = 0

        contextLabel.font = .italicSystemFont(ofSize: 16)
        contextLabel.textColor = .secondaryLabel
        contextLabel.numberOfLines = 0

        metaLabel.font = Theme.Font.caption
        metaLabel.textColor = .tertiaryLabel
        metaLabel.numberOfLines = 0

        statusMessageLabel.font = Theme.Font.callout
        statusMessageLabel.textColor = Theme.Colors.statMastered
        statusMessageLabel.numberOfLines = 0
        statusMessageLabel.textAlignment = .center

        // Buttons
        primaryButton.addTarget(self, action: #selector(primaryAction), for: .touchUpInside)
        primaryButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        primaryButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        secondaryButton.addTarget(self, action: #selector(secondaryAction), for: .touchUpInside)
        secondaryButton.addTarget(self, action: #selector(buttonTouchDown(_:)), for: .touchDown)
        secondaryButton.addTarget(self, action: #selector(buttonTouchUp(_:)), for: [.touchUpInside, .touchUpOutside, .touchCancel])

        // Cards
        let headerCard = makeCard(content: makeHeaderContent(wordLabel: wordLabel))
        let definitionCard = makeCard(content: makeSection(title: "释义", icon: "text.book.closed.fill", contentView: definitionLabel))
        let contextCard = makeCard(content: makeSection(title: "例句", icon: "quote.bubble.fill", contentView: contextLabel))
        let metaCard = makeCard(content: makeSection(title: "信息", icon: "info.circle.fill", contentView: metaLabel))

        // Action buttons
        Theme.applyPrimaryStyle(to: primaryButton)
        Theme.applySecondaryStyle(to: secondaryButton)

        let actionStack = UIStackView(arrangedSubviews: [primaryButton, secondaryButton])
        actionStack.axis = .vertical
        actionStack.spacing = Theme.Spacing.md

        let stack = UIStackView(arrangedSubviews: [
            headerCard,
            definitionCard,
            contextCard,
            metaCard,
            actionStack,
            statusMessageLabel
        ])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.lg
        stack.translatesAutoresizingMaskIntoConstraints = false

        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(scrollView)
        scrollView.addSubview(stack)

        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),

            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: Theme.Spacing.xl),
            stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: Theme.Spacing.xl),
            stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -Theme.Spacing.xl),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -Theme.Spacing.xxxl),
            stack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -Theme.Spacing.xl * 2)
        ])
    }

    private func makeCard(content: UIView) -> UIView {
        let card = UIView()
        card.backgroundColor = Theme.Colors.cardBackground
        card.layer.cornerRadius = Theme.Radius.medium
        Theme.applyCardShadow(to: card.layer)

        content.translatesAutoresizingMaskIntoConstraints = false
        card.addSubview(content)

        NSLayoutConstraint.activate([
            content.topAnchor.constraint(equalTo: card.topAnchor, constant: Theme.Spacing.xl),
            content.leadingAnchor.constraint(equalTo: card.leadingAnchor, constant: Theme.Spacing.xl),
            content.trailingAnchor.constraint(equalTo: card.trailingAnchor, constant: -Theme.Spacing.xl),
            content.bottomAnchor.constraint(equalTo: card.bottomAnchor, constant: -Theme.Spacing.xl)
        ])

        return card
    }

    private func makeHeaderContent(wordLabel: UILabel) -> UIView {
        let row = UIStackView(arrangedSubviews: [wordLabel, statusBadge])
        row.axis = .horizontal
        row.alignment = .center
        row.spacing = Theme.Spacing.sm

        statusBadge.setContentHuggingPriority(.required, for: .horizontal)

        let stack = UIStackView(arrangedSubviews: [row, phoneticLabel])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.sm
        return stack
    }

    private func makeSection(title: String, icon: String, contentView: UIView) -> UIView {
        let iconView = UIImageView(image: UIImage(systemName: icon))
        iconView.tintColor = Theme.Colors.accent
        iconView.translatesAutoresizingMaskIntoConstraints = false
        iconView.widthAnchor.constraint(equalToConstant: 16).isActive = true
        iconView.heightAnchor.constraint(equalToConstant: 16).isActive = true

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = Theme.Font.caption
        titleLabel.textColor = Theme.Colors.subtleText

        let titleRow = UIStackView(arrangedSubviews: [iconView, titleLabel])
        titleRow.axis = .horizontal
        titleRow.spacing = Theme.Spacing.xs
        titleRow.alignment = .center

        let stack = UIStackView(arrangedSubviews: [titleRow, contentView])
        stack.axis = .vertical
        stack.spacing = Theme.Spacing.sm
        return stack
    }

    private func render() {
        guard let info = store.words[word] else {
            statusBadge.text = "不存在"
            primaryButton.isHidden = true
            secondaryButton.isHidden = true
            return
        }

        let isMastered = info.status == "mastered"
        statusBadge.text = "  \(isMastered ? "已掌握" : "学习中")  "
        statusBadge.textColor = isMastered ? Theme.Colors.statMastered : Theme.Colors.statLearning
        statusBadge.backgroundColor = (isMastered ? Theme.Colors.statMastered : Theme.Colors.statLearning).withAlphaComponent(0.12)

        phoneticLabel.text = info.phonetic?.isEmpty == false ? info.phonetic : "无音标"
        definitionLabel.text = info.definition?.isEmpty == false ? info.definition : "暂无释义"
        contextLabel.text = info.latestSentence.isEmpty ? "没有保存例句。" : info.latestSentence

        let dueText = formattedDue(info.dueAt)
        metaLabel.text = [
            "加入：\(info.firstSeen ?? "未知")",
            "更新：\(info.lastSeen ?? "未知")",
            "复习：\(info.reviewCount ?? 0) 次",
            dueText
        ].joined(separator: "\n")

        primaryButton.setTitle(isMastered ? "重新学习" : "标记已掌握", for: .normal)

        secondaryButton.setTitle(isMastered ? "已掌握" : "设为今天复习", for: .normal)
        secondaryButton.setImage(isMastered ? nil : UIImage(systemName: "calendar.badge.clock"), for: .normal)
        secondaryButton.isEnabled = !isMastered
        secondaryButton.alpha = isMastered ? 0.45 : 1
    }

    private func formattedDue(_ value: String?) -> String {
        guard let date = DateCoding.parseDue(value) else {
            return "到期：已到期"
        }

        if date <= Date() {
            return "到期：已到期"
        }

        return "到期：\(DateCoding.localMinuteString(date))"
    }

    // MARK: - Actions

    @objc private func primaryAction() {
        guard let info = store.words[word] else { return }
        if info.status == "mastered" {
            store.updateStatus(word: word, status: "learning")
            statusMessageLabel.text = "已重新加入学习队列"
        } else {
            store.updateStatus(word: word, status: "mastered")
            statusMessageLabel.text = "已标记为已掌握"
        }
        animateStatusMessage()
        render()
    }

    @objc private func secondaryAction() {
        store.updateStatus(word: word, status: "learning")
        statusMessageLabel.text = "已安排为今天复习"
        animateStatusMessage()
        render()
    }

    private func animateStatusMessage() {
        statusMessageLabel.alpha = 0
        statusMessageLabel.transform = CGAffineTransform(translationX: 0, y: 8)
        UIView.animate(withDuration: 0.3, delay: 0, options: .curveEaseOut) {
            self.statusMessageLabel.alpha = 1
            self.statusMessageLabel.transform = .identity
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
