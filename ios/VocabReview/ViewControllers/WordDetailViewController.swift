import UIKit

final class WordDetailViewController: UIViewController {
    private let store = VocabStore.shared
    private let word: String

    private let statusLabel = UILabel()
    private let phoneticLabel = UILabel()
    private let definitionLabel = UILabel()
    private let contextLabel = UILabel()
    private let metaLabel = UILabel()
    private let primaryButton = UIButton(type: .system)
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
        view.backgroundColor = .systemBackground
        setupViews()
        render()
    }

    private func setupViews() {
        let wordLabel = UILabel()
        wordLabel.text = word
        wordLabel.font = .systemFont(ofSize: 34, weight: .bold)
        wordLabel.textColor = .label
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = true
        wordLabel.minimumScaleFactor = 0.7

        statusLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        statusLabel.textColor = .secondaryLabel

        phoneticLabel.font = .systemFont(ofSize: 16, weight: .medium)
        phoneticLabel.textColor = .secondaryLabel

        definitionLabel.font = .systemFont(ofSize: 18)
        definitionLabel.textColor = .label
        definitionLabel.numberOfLines = 0

        contextLabel.font = .italicSystemFont(ofSize: 16)
        contextLabel.textColor = .secondaryLabel
        contextLabel.numberOfLines = 0

        metaLabel.font = .systemFont(ofSize: 13)
        metaLabel.textColor = .tertiaryLabel
        metaLabel.numberOfLines = 0

        statusMessageLabel.font = .systemFont(ofSize: 14)
        statusMessageLabel.textColor = .secondaryLabel
        statusMessageLabel.numberOfLines = 0

        configureButton(primaryButton, fill: true)
        configureButton(secondaryButton, fill: false)

        primaryButton.addTarget(self, action: #selector(primaryAction), for: .touchUpInside)
        secondaryButton.addTarget(self, action: #selector(secondaryAction), for: .touchUpInside)

        let actionStack = UIStackView(arrangedSubviews: [primaryButton, secondaryButton])
        actionStack.axis = .vertical
        actionStack.spacing = 10

        let stack = UIStackView(arrangedSubviews: [
            wordLabel,
            statusLabel,
            phoneticLabel,
            section(title: "释义", content: definitionLabel),
            section(title: "例句", content: contextLabel),
            metaLabel,
            actionStack,
            statusMessageLabel
        ])
        stack.axis = .vertical
        stack.spacing = 16
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

            stack.topAnchor.constraint(equalTo: scrollView.contentLayoutGuide.topAnchor, constant: 22),
            stack.leadingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: scrollView.contentLayoutGuide.trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(equalTo: scrollView.contentLayoutGuide.bottomAnchor, constant: -28),
            stack.widthAnchor.constraint(equalTo: scrollView.frameLayoutGuide.widthAnchor, constant: -40),

            primaryButton.heightAnchor.constraint(equalToConstant: 48),
            secondaryButton.heightAnchor.constraint(equalToConstant: 46)
        ])
    }

    private func section(title: String, content: UIView) -> UIView {
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        titleLabel.textColor = .secondaryLabel

        let stack = UIStackView(arrangedSubviews: [titleLabel, content])
        stack.axis = .vertical
        stack.spacing = 8
        return stack
    }

    private func configureButton(_ button: UIButton, fill: Bool) {
        button.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        button.layer.cornerRadius = 8
        if fill {
            button.backgroundColor = .systemBlue
            button.tintColor = .white
        } else {
            button.backgroundColor = .secondarySystemBackground
            button.tintColor = .systemBlue
        }
    }

    private func render() {
        guard let info = store.words[word] else {
            statusLabel.text = "词条不存在"
            primaryButton.isHidden = true
            secondaryButton.isHidden = true
            return
        }

        let isMastered = info.status == "mastered"
        statusLabel.text = isMastered ? "已掌握" : "学习中"
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

    @objc private func primaryAction() {
        guard let info = store.words[word] else { return }
        if info.status == "mastered" {
            store.updateStatus(word: word, status: "learning")
            statusMessageLabel.text = "已重新加入学习队列"
        } else {
            store.updateStatus(word: word, status: "mastered")
            statusMessageLabel.text = "已标记为已掌握"
        }
        render()
    }

    @objc private func secondaryAction() {
        store.updateStatus(word: word, status: "learning")
        statusMessageLabel.text = "已安排为今天复习"
        render()
    }
}
